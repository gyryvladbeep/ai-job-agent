const cron = require("node-cron");
const { processJobs } = require("./index");

// Runs three times a day, Yerevan time: 10:00, 15:00, 20:00.
// node-cron resolves the timezone itself (via the underlying cron
// engine), so this stays correct even though Armenia doesn't observe
// daylight saving time -- no manual UTC offset math needed.
const SCHEDULE = "0 10,15,20 * * *";
const TIMEZONE = "Asia/Yerevan";

function logYerevanTime(label) {
    const now = new Date().toLocaleString("en-GB", {
        timeZone: TIMEZONE,
        hour12: false,
    });

    console.log(`${label}: ${now} (${TIMEZONE})`);
}

console.log("🕒 AI Job Agent scheduler starting");
console.log(`🕒 Schedule: ${SCHEDULE} (${TIMEZONE}) -- runs at 10:00, 15:00, and 20:00 daily`);
logYerevanTime("🕒 Current time");
console.log("🕒 Waiting for the next scheduled run. Keep this process running (e.g. via pm2, a systemd service, or Task Scheduler on Windows).");

cron.schedule(
    SCHEDULE,
    async () => {
        logYerevanTime("\n⏰ Scheduled run triggered");

        try {
            await processJobs();
        } catch (error) {
            console.error("❌ Scheduled run crashed:");
            console.error(error?.stack || error);
        }
    },
    { timezone: TIMEZONE }
);

// Don't let one bad run (or a bug in a parser) silently kill the
// long-running process -- log it and keep waiting for the next tick.
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught exception (scheduler keeps running):");
    console.error(error?.stack || error);
});

process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled promise rejection (scheduler keeps running):");
    console.error(error?.stack || error);
});
