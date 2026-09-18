require("dotenv").config();

const TelegramBotModule = require("node-telegram-bot-api");

const TelegramBot =
    TelegramBotModule.default || TelegramBotModule;

const { hasRelocationSignal } = require("../utils/relocationTag");
const {
    buildRecruiterSearchLink
} = require("../utils/recruiterSearchLink");

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
}

if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID is not configured");
}

const bot = new TelegramBot(token, {
    polling: false
});

function buildMessage(job) {
    const lines = [
        "New QA Engineer vacancy",
        "",
        `Company: ${job.company}`,
        `Position: ${job.position}`,
        `Source: ${job.source}`,
        "",
        job.url
    ];

    /*
     * Метка релокации -- только если сигнал реально найден в тексте,
     * чтобы не засорять каждое уведомление (по запросу пользователя:
     * "чтобы не мешало общему потоку вакансий, сделать просто
     * припиской").
     */
    if (hasRelocationSignal(job)) {
        lines.push("");
        lines.push("Possible relocation/visa support mentioned -- check the listing");
    }

    /*
     * Ссылка на поиск рекрутера в LinkedIn -- всегда добавляется
     * припиской (не требует детектирования, просто готовая ссылка).
     */
    const recruiterLink = buildRecruiterSearchLink(job.company);

    if (recruiterLink) {
        lines.push("");
        lines.push(`Find a recruiter: ${recruiterLink}`);
    }

    return lines.join("\n");
}

/*
 * Кнопки статуса под уведомлением -- callback_data специально
 * короткий ("a:<id>" и т.д., не "applied:<id>"), у Telegram лимит
 * 64 байта на callback_data, а id вакансии здесь неизвестного
 * заранее формата (int или uuid). Слушает эти нажатия
 * src/services/telegramListener.js -- он же снимает клавиатуру и
 * пишет статус в Supabase.
 */
function buildStatusKeyboard(jobId) {
    return {
        inline_keyboard: [
            [
                { text: "Applied", callback_data: `a:${jobId}` },
                { text: "Skipped", callback_data: `s:${jobId}` },
                { text: "Interview", callback_data: `i:${jobId}` }
            ]
        ]
    };
}

async function sendJob(job) {
    const message = buildMessage(job);

    try {
        await bot.sendMessage(chatId, message, {
            reply_markup: buildStatusKeyboard(job.id)
        });

        console.log(
            `Telegram notification sent: ${job.company} -- ${job.position}`
        );

        return true;

    } catch (error) {
        console.error("Telegram error:");
        console.error(error.message);

        return false;
    }
}

module.exports = {
    sendJob,
    buildMessage,
    buildStatusKeyboard
};
