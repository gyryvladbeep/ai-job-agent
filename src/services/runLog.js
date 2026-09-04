const fs = require("fs");
const path = require("path");

// Persists a machine-readable summary of every run to disk (last-run.json
// always has the most recent run; run-history.log appends one line per
// run). This exists so a run's per-source numbers are still inspectable
// later without needing to have had eyes on the terminal when it fired --
// the scheduler runs unattended 3x/day, so the console output alone was
// effectively write-only.

const LOG_DIR = path.join(__dirname, "..", "..", "logs");

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

function writeRunSummary(summary) {
    try {
        ensureLogDir();

        const withTimestamp = {
            timestamp: new Date().toISOString(),
            ...summary
        };

        fs.writeFileSync(
            path.join(LOG_DIR, "last-run.json"),
            JSON.stringify(withTimestamp, null, 2),
            "utf-8"
        );

        fs.appendFileSync(
            path.join(LOG_DIR, "run-history.log"),
            JSON.stringify(withTimestamp) + "\n",
            "utf-8"
        );
    } catch (error) {
        console.log("⚠️ Could not write run log");
        console.log(error?.message || error);
    }
}

module.exports = {
    writeRunSummary
};
