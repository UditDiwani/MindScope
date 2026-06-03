const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

const pythonCommand = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const scriptPath = path.join(__dirname, "..", "ML", "sentiment.py");

function computeBasicSentiment(text) {
    if (!text || typeof text !== "string" || !text.trim()) {
        return { neg: 0, neu: 1, pos: 0, compound: 0 };
    }

    const lower = text.toLowerCase();
    const positiveWords = ["support", "supported", "cope", "coping", "focused", "calm", "progress", "help", "manageable", "confident", "better"];
    const negativeWords = ["stress", "deadline", "overwhelmed", "anxious", "tired", "hopeless", "pressure", "conflict", "stuck", "difficult"];

    let posCount = 0;
    let negCount = 0;

    for (const w of positiveWords) {
        if (lower.includes(w)) posCount++;
    }

    for (const w of negativeWords) {
        if (lower.includes(w)) negCount++;
    }

    const total = posCount + negCount;

    if (total === 0) {
        return { neg: 0, neu: 1, pos: 0, compound: 0 };
    }

    const pos = posCount / total;
    const neg = negCount / total;
    const neu = Math.max(0, 1 - pos - neg);
    const compound = Number(((posCount - negCount) / total).toFixed(3));

    return { neg, neu, pos, compound };
}

router.post("/", (req, res) => {
    const text = req.body && typeof req.body.text === "string" ? req.body.text : "";

    const py = spawn(pythonCommand, [scriptPath, text]);

    let result = "";
    let error = "";
    let responseSent = false;

    py.stdout.on("data", (data) => {
        result += data.toString();
    });

    py.stderr.on("data", (data) => {
        error += data.toString();
    });

    py.on("error", (err) => {
        // If Python process couldn't start, return a JS-based fallback instead of failing
        responseSent = true;
        const fallback = computeBasicSentiment(text);
        return res.json(fallback);
    });

    py.on("close", (code) => {
        if (responseSent) return;

        try {
            const payload = result ? JSON.parse(result) : null;

            if (code !== 0 || !payload) {
                // If Python failed or returned invalid JSON, fall back to JS implementation
                const fallback = computeBasicSentiment(text);
                return res.json(fallback);
            }

            return res.json(payload);
        } catch (err) {
            const fallback = computeBasicSentiment(text);
            return res.json(fallback);
        }
    });
});

module.exports = router;
