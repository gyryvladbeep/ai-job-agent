/*
 * Полная очистка базы вакансий -- пользователь нашёл работу, поиск
 * закрыт, и база попросту больше не нужна. В отличие от
 * src/recheckVacancies.js здесь НЕ проверяется живость каждой
 * вакансии и ничего не шлётся в Telegram -- удаляются вообще ВСЕ
 * строки таблицы без исключений, включая applied/interview/skipped.
 *
 * По умолчанию это DRY RUN -- только показывает, сколько строк и с
 * какими статусами будет удалено, ничего не меняя в базе. Чтобы
 * выполнить по-настоящему, нужен флаг --apply:
 *
 *   npm run clear-vacancies            -- только отчёт (безопасно)
 *   npm run clear-vacancies -- --apply -- реальное удаление всего
 *
 * После реальной очистки см. README/сообщение в чате о том, как
 * остановить сам планировщик (npm start) -- иначе при следующем
 * автозапуске он сравнит найденные вакансии с пустой базой и
 * пришлёт в Telegram вообще всё, что когда-либо находил, как
 * "новое".
 */

require("dotenv").config();

const { getAllVacancies, deleteAllVacancies } = require("./services/supabase");
const { summarizeByStatus } = require("./core/summarizeByStatus");
const { createLogger } = require("./core/logger");

const logger = createLogger("ClearVacancies");

async function clearVacancies({ apply }) {
    const jobs = await getAllVacancies();

    logger.info(`found ${jobs.length} vacancies currently in the database`);

    const byStatus = summarizeByStatus(jobs);

    for (const [status, count] of Object.entries(byStatus)) {
        logger.info(`  status "${status}": ${count}`);
    }

    if (jobs.length === 0) {
        logger.info("nothing to delete -- database is already empty");
        return { total: 0, deleted: 0 };
    }

    if (!apply) {
        logger.info(`DRY RUN -- would delete all ${jobs.length} rows listed above`);
        logger.info("run again with --apply to actually delete everything");
        return { total: jobs.length, deleted: 0 };
    }

    const result = await deleteAllVacancies();

    if (!result.ok) {
        logger.error("deletion failed -- see error above, nothing was removed");
        return { total: jobs.length, deleted: 0 };
    }

    logger.warn(`done -- deleted ${jobs.length} vacancies, database is now empty`);
    logger.warn("remember to stop the scheduler (npm start) too -- see chat for how");

    return { total: jobs.length, deleted: jobs.length };
}

if (require.main === module) {
    const apply = process.argv.includes("--apply");

    clearVacancies({ apply })
        .then(() => process.exit(0))
        .catch(error => {
            logger.error(`fatal error: ${error?.message || error}`);
            process.exit(1);
        });
}

module.exports = {
    clearVacancies
};
