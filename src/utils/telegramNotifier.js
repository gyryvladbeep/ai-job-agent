const axios = require("axios");

async function sendTelegramNotification(job) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error(
            "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in .env"
        );
    }

    const company = job.company || "Unknown";
    const position = job.position || "QA vacancy";
    const source = job.source || "Unknown";
    const url = job.url;

    if (!url) {
        console.log(
            `⚠️ Skipping Telegram notification: no URL for ${company} — ${position}`
        );
        return false;
    }

    const message = [
        "🆕 <b>Новая QA-вакансия</b>",
        "",
        `💼 <b>${escapeHtml(position)}</b>`,
        `🏢 ${escapeHtml(company)}`,
        "",
        `📡 Источник: ${escapeHtml(source)}`,
        "",
        "⚡ Вакансия найдена автоматически",
    ].join("\n");

    const keyboard = {
        inline_keyboard: [
            [
                {
                    text: "🔗 Откликнуться",
                    url: url,
                },
            ],
        ],
    };

    try {
        await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: keyboard,
            }
        );

        console.log(
            `📨 Telegram notification sent: ${company} — ${position}`
        );

        return true;
    } catch (error) {
        const telegramError =
            error.response?.data?.description ||
            error.message ||
            "Unknown Telegram error";

        console.error(
            `❌ Telegram notification failed: ${company} — ${position}`
        );
        console.error(`Telegram error: ${telegramError}`);

        return false;
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

module.exports = {
    sendTelegramNotification,
};