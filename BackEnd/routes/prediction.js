const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

const pythonCommand = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const scriptPath = path.join(__dirname, "..", "ML", "predict.py");

router.post("/", (req, res) => {

    const py = spawn(
        pythonCommand,
        [
            scriptPath,
            JSON.stringify(req.body)
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

            if (code !== 0 || payload.error) {
                return res.status(500).json({ error: payload.error || error || "Prediction failed" });
            }

            return res.json(payload);
        } catch (err) {
            return res.status(500).json({ error: error || "Prediction returned invalid JSON" });
        }
    });

});

module.exports = router;
