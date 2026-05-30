const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

const pythonCommand = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const scriptPath = path.join(__dirname, "..", "ML", "sentiment.py");

router.post("/", (req, res) => {
    const text = req.body && typeof req.body.text === "string" ? req.body.text : "";

    const py = spawn(
        pythonCommand,
        [
            scriptPath,
            text
        ]
    );

    let result = "";
    let error = "";
    let responseSent = false;

    py.stdout.on("data", data => {
        result += data.toString();
    });

    py.stderr.on("data", data => {
        error += data.toString();
    });

    py.on("error", err => {
        responseSent = true;
        res.status(500).json({ error: `Unable to start Python process: ${err.message}` });
    });

    py.on("close", code => {
        if (responseSent) {
            return;
        }

        try {
            const payload = result ? JSON.parse(result) : {};

            if (code !== 0) {
                return res.status(500).json({ error: error || "Sentiment analysis failed" });
            }

            return res.json(payload);
        } catch (err) {
            return res.status(500).json({ error: error || "Sentiment analysis returned invalid JSON" });
        }
    });

});

module.exports = router;
