/*
 * Слушатель нажатий на кнопки статуса ("Applied" / "Skipped" /
 * "Interview") под уведомлениями о вакансиях -- превращает бота из
 * чистого оповещателя в лёгкий трекер воронки отклика.
 *
 * Отдельный экземпляр бота с polling:true -- специально не трогаем
 * общий bot из telegram.js (там polling:false, он только шлёт
 * сообщения при каждом прогоне скрейпера). Два независимых клиента
 * на одном токене конфликтуют, только если оба одновременно
 * поллят -- здесь поллит только этот, второй всегда молчит.
 *
 * Рассчитан на запуск внутри уже существующего долгоживущего
 * процесса (src/scheduler.js, тот же, что крутит cron) -- отдельно
 * поднимать/поддерживать ещё один процесс не нужно.
 */

require("dotenv").config();

const TelegramBotModule = require("node-telegram-bot-api");

const TelegramBot = TelegramBotModule.default || TelegramBotModule;

const { setVacancyStatus } = require("./supabase");
const { createLogger } = require("../core/logger");

const logger = createLogger("TelegramListener");

const token = process.env.TELEGRAM_BOT_TOKEN;

const STATUS_BY_PREFIX = {
    a: { status: "applied", label: "Applied" },
    s: { status: "skipped", label: "Skipped" },
    i: { status: "interview", label: "Interview" }
};

function parseCallbackData(data) {
    const separatorIndex = String(data || "").indexOf(":");

    if (separatorIndex === -1) {
        return null;
    }

    const prefix = data.slice(0, separatorIndex);
    const jobId = data.slice(separatorIndex + 1);

    const meta = STATUS_BY_PREFIX[prefix];

    if (!meta || !jobId) {
        return null;
    }

    return { ...meta, jobId };
}

function startTelegramListener() {
    if (!token) {
        logger.warn("not started: TELEGRAM_BOT_TOKEN is not configured");
        return null;
    }

    const listenerBot = new TelegramBot(token, { polling: true });

    listenerBot.on("callback_query", async (query) => {
        const parsed = parseCallbackData(query.data);

        if (!parsed) {
            await listenerBot
                .answerCallbackQuery(query.id, { text: "Unrecognized button, ignored." })
                .catch(() => {});
            return;
        }

        const { status, label, jobId } = parsed;

        try {
            await setVacancyStatus(jobId, status);

            await listenerBot.answerCallbackQuery(query.id, {
                text: `Marked: ${label}`
            });

            // Убираем клавиатуру и дописываем в текст, что выбрано,
            // чтобы не было соблазна/возможности нажать дважды и
            // не было неясно, какой статус в итоге записан.
            const originalText = query.message?.text || "";

            await listenerBot.editMessageText(
                `${originalText}\n\n[Status: ${label}]`,
                {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    reply_markup: { inline_keyboard: [] }
                }
            );
        } catch (error) {
            logger.error(`failed to process callback: ${error?.message || error}`);

            await listenerBot
                .answerCallbackQuery(query.id, { text: "Something went wrong, try again." })
                .catch(() => {});
        }
    });

    listenerBot.on("polling_error", (error) => {
        logger.error(`polling error: ${error?.message || error}`);
    });

    logger.info("started -- status buttons (Applied/Skipped/Interview) are now live");

    return listenerBot;
}

module.exports = {
    startTelegramListener
};
