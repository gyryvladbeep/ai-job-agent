require("dotenv").config();

const TelegramBotModule = require("node-telegram-bot-api");

const TelegramBot =
    TelegramBotModule.default || TelegramBotModule;

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
    throw new Error("❌ TELEGRAM_BOT_TOKEN is not configured");
}

if (!chatId) {
    throw new Error("❌ TELEGRAM_CHAT_ID is not configured");
}

const bot = new TelegramBot(token, {
    polling: false
});

async function sendJob(job) {
    const message = [
        "🆕 QA Engineer vacancy",
        "",
        `🏢 Company: ${job.company}`,
        `💼 Position: ${job.position}`,
        `🌐 Source: ${job.source}`,
        "",
        `🔗 ${job.url}`
    ].join("\n");

    try {
        await bot.sendMessage(chatId, message);

        console.log(
            `📨 Telegram notification sent: ${job.company} — ${job.position}`
        );

        return true;

    } catch (error) {
        console.error("❌ Telegram error:");
        console.error(error.message);

        return false;
    }
}

module.exports = {
    sendJob
};