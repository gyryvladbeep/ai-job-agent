/*
 * Разовая массовая проверка базы (по запросу пользователя, база
 * "сильно забита"). Проходит по ВСЕМ вакансиям в Supabase, вообще
 * без исключений по статусу -- это был явный выбор пользователя,
 * несмотря на предупреждение, что вакансии со статусом
 * applied/interview тоже попадут под удаление, если сама вакансия
 * на сайте больше не активна.
 *
 * Для каждой вакансии:
 *   - проверяем isVacancyLive(url);
 *   - если жива -- шлём её повторно в Telegram (с теми же кнопками
 *     статуса Applied/Skipped/Interview), запись в базе НЕ трогаем
 *     и её статус НЕ меняем (если она была "applied", так и
 *     останется "applied" после повторной отправки);
 *   - если мертва (404/410 или текст "вакансия закрыта" и т.п.) --
 *     удаляем запись из базы совсем.
 *
 * По умолчанию это DRY RUN -- только отчёт, ничего не меняется и
 * никому ничего не шлётся. Чтобы выполнить по-настоящему, нужен
 * флаг --apply:
 *
 *   npm run recheck            -- только отчёт (безопасно)
 *   npm run recheck -- --apply -- реальная отправка + удаление
 */

require("dotenv").config();

const { getAllVacancies, deleteJob } = require("./services/supabase");
const { sendJob } = require("./services/telegram");
const { isVacancyLive } = require("./utils/isVacancyLive");
const { createLogger } = require("./core/logger");
const { sleep } = require("./core/retry");
const { decideAction } = require("./core/recheckDecision");

const logger = createLogger("Recheck");

// Пауза между вакансиями -- чтобы не долбить сайты вакансий и
// Telegram API слишком часто подряд одной строкой запросов.
const DELAY_BETWEEN_JOBS_MS = 700;

async function recheckVacancies({ apply }) {
    const jobs = await getAllVacancies();

    logger.info(`loaded ${jobs.length} vacancies from Supabase`);

    if (jobs.length === 0) {
        logger.info("nothing to check");
        return { total: 0, live: 0, dead: 0, errors: 0 };
    }

    if (!apply) {
        logger.info("DRY RUN -- no messages will be sent, nothing will be deleted");
        logger.info("run again with --apply to actually resend/delete");
    }

    let live = 0;
    let dead = 0;
    let errors = 0;
    const byStatus = {};

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const label = `[${i + 1}/${jobs.length}] ${job.company} -- ${job.position} (status: ${job.status})`;

        byStatus[job.status] = byStatus[job.status] || { live: 0, dead: 0 };

        try {
            const isLive = await isVacancyLive(job.url);
            const action = decideAction(isLive);

            if (action === "resend") {
                live++;
                byStatus[job.status].live++;
                logger.info(`${label} -- LIVE, resending`);

                if (apply) {
                    const sent = await sendJob(job);

                    if (!sent) {
                        errors++;
                        logger.warn(`${label} -- failed to send, kept in DB as-is`);
                    }
                }
            } else {
                dead++;
                byStatus[job.status].dead++;
                logger.warn(`${label} -- DEAD, deleting`);

                if (apply) {
                    const deleted = await deleteJob(job.id);

                    if (!deleted) {
                        errors++;
                        logger.warn(`${label} -- failed to delete from DB`);
                    }
                }
            }
        } catch (error) {
            errors++;
            logger.error(`${label} -- unexpected error: ${error?.message || error}`);
        }

        await sleep(DELAY_BETWEEN_JOBS_MS);
    }

    logger.info("---- summary ----");
    logger.info(`total checked: ${jobs.length}`);
    logger.info(`live (${apply ? "resent, kept in DB" : "would resend"}): ${live}`);
    logger.info(`dead (${apply ? "deleted from DB" : "would delete"}): ${dead}`);
    logger.info(`errors: ${errors}`);

    for (const [status, counts] of Object.entries(byStatus)) {
        logger.info(`  status "${status}": ${counts.live} live, ${counts.dead} dead`);
    }

    if (!apply) {
        logger.info("this was a DRY RUN -- to actually run it: npm run recheck -- --apply");
    }

    return { total: jobs.length, live, dead, errors };
}

if (require.main === module) {
    const apply = process.argv.includes("--apply");

    recheckVacancies({ apply })
        .then(() => process.exit(0))
        .catch(error => {
            logger.error(`fatal error: ${error?.message || error}`);
            process.exit(1);
        });
}

module.exports = {
    recheckVacancies
};
