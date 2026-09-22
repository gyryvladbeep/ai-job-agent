const cron = require("node-cron");
const { processJobs } = require("./index");
const { startTelegramListener } = require("./services/telegramListener");
const { createLogger } = require("./core/logger");

const logger = createLogger("Scheduler");

// Runs three times a day, Yerevan time: 10:00, 15:00, 20:00.
// node-cron resolves the timezone itself (via the underlying cron
// engine), so this stays correct even though Armenia doesn't observe
// daylight saving time -- no manual UTC offset math needed.
const SCHEDULE = "0 10,15,20 * * *";
const TIMEZONE = "Asia/Yerevan";

function logYerevanTime(label) {
    const now = new Date().toLocaleString("en-GB", {
        timeZone: TIMEZONE,
        hour12: false
    });

    logger.info(`${label}: ${now} (${TIMEZONE})`);
}

logger.info("AI Job Agent scheduler starting");

// Слушатель кнопок статуса ("Applied"/"Skipped"/"Interview") живёт в
// этом же процессе -- отдельно поднимать и поддерживать ничего не
// нужно, работает пока запущен обычный `npm start`.
startTelegramListener();

logger.info(`schedule: ${SCHEDULE} (${TIMEZONE}) -- runs at 10:00, 15:00, and 20:00 daily`);
logYerevanTime("current time");
logger.info("waiting for the next scheduled run. Keep this process running (e.g. via pm2, a systemd service, or Task Scheduler on Windows).");

cron.schedule(
    SCHEDULE,
    async () => {
        logYerevanTime("scheduled run triggered");

        try {
            await processJobs();
        } catch (error) {
            logger.error(`scheduled run crashed: ${error?.stack || error}`);
        }
    },
    { timezone: TIMEZONE }
);

// Don't let one bad run (or a bug in a parser) silently kill the
// long-running process -- log it and keep waiting for the next tick.
process.on("uncaughtException", (error) => {
    logger.error(`uncaught exception (scheduler keeps running): ${error?.stack || error}`);
});

process.on("unhandledRejection", (error) => {
    logger.error(`unhandled promise rejection (scheduler keeps running): ${error?.stack || error}`);
});
