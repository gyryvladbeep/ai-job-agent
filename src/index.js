require("dotenv").config();

const { SOURCES } = require("./config/sources");

const {
    jobExists,
    saveJobs,
    markAsNotified,
    markAsExpired
} = require("./services/supabase");

const { sendJob } = require("./services/telegram");
const { isVacancyLive } = require("./utils/isVacancyLive");
const { filterQaJobs } = require("./utils/qaFilter");
const { dedupeByUrl } = require("./core/dedupe");
const { createLogger } = require("./core/logger");
const { writeRunSummary } = require("./services/runLog");

const logger = createLogger("Pipeline");

async function collectFromSource(name, parser) {
    logger.info("");
    logger.info(`--- starting source: ${name} ---`);

    try {
        const jobs = await parser();

        logger.info(`${name}: ${jobs.length} jobs collected`);

        return jobs;
    } catch (error) {
        logger.error(`${name} parser failed: ${error?.message || error}`);
        logger.warn("continuing with other sources...");

        return [];
    }
}

async function collectJobs() {
    logger.info("collecting vacancies from all sources...");

    const allJobs = [];
    const bySource = {};

    for (const { name, parser } of SOURCES) {
        const jobs = await collectFromSource(name, parser);

        bySource[name] = jobs.length;

        allJobs.push(...jobs);
    }

    logger.info(`TOTAL COLLECTED: ${allJobs.length}`);

    return { allJobs, bySource };
}

async function processJobs() {
    logger.info("AI Job Agent started");

    // Filled in as we go, written to logs/ no matter where the run
    // stops -- see src/services/runLog.js. This is what lets a run's
    // numbers be inspected later without having watched the terminal
    // when the scheduler fired.
    const runSummary = {
        bySource: {},
        qaFilteredBySource: {},
        newBySource: {},
        collected: 0,
        qaFiltered: 0,
        unique: 0,
        new: 0,
        saved: 0,
        notified: 0,
        notificationErrors: 0,
        expired: 0,
        stoppedAt: "started",
        error: null
    };

    try {
        // ==========================================
        // 1. COLLECT
        // ==========================================

        const { allJobs: collectedJobs, bySource } = await collectJobs();

        runSummary.bySource = bySource;
        runSummary.collected = collectedJobs.length;

        if (collectedJobs.length === 0) {
            logger.info("no jobs collected from any source");

            runSummary.stoppedAt = "collect";
            writeRunSummary(runSummary);

            return;
        }

        // ==========================================
        // 2. QA FILTER
        // ==========================================

        logger.info("applying QA filter...");

        const qaJobs = filterQaJobs(collectedJobs);

        logger.info(`QA jobs after filtering: ${qaJobs.length}`);

        runSummary.qaFiltered = qaJobs.length;

        // Разбивка "прошло QA-фильтр" по источникам -- без неё
        // источник может честно собирать десятки вакансий (bySource
        // выглядит здоровым) и при этом ни одна не будет реальной
        // QA-позицией -- и это останется незаметным, пока кто-то не
        // полезет разбираться вручную. Именно так неделю не замечали,
        // что Wellfound отдавал 45-51 вакансию в день, из которых 0
        // проходили QA-фильтр.
        const qaFilteredBySource = {};
        for (const job of qaJobs) {
            const key = job.source || "Unknown";
            qaFilteredBySource[key] = (qaFilteredBySource[key] || 0) + 1;
        }
        runSummary.qaFilteredBySource = qaFilteredBySource;

        if (qaJobs.length === 0) {
            logger.info("no QA jobs after filtering");

            runSummary.stoppedAt = "qaFilter";
            writeRunSummary(runSummary);

            return;
        }

        // ==========================================
        // 3. REMOVE DUPLICATES
        // ==========================================

        logger.info("removing duplicates...");

        const uniqueJobs = dedupeByUrl(qaJobs);

        logger.info(`unique jobs: ${uniqueJobs.length}`);

        runSummary.unique = uniqueJobs.length;

        // ==========================================
        // 4. CHECK SUPABASE
        // ==========================================

        logger.info("checking Supabase...");

        const newJobs = [];

        for (const job of uniqueJobs) {
            try {
                const exists = await jobExists(job.url);

                if (exists) {
                    logger.info(`already exists: ${job.company} -- ${job.position}`);
                    continue;
                }

                newJobs.push(job);
            } catch (error) {
                logger.error(`Supabase check failed for: ${job.position}: ${error?.message || error}`);
            }
        }

        logger.info(`new jobs found: ${newJobs.length}`);

        runSummary.new = newJobs.length;

        // Разбивка "new" по источникам -- это то, что реально отвечает
        // на вопрос "откуда пришли сегодняшние уведомления", в отличие
        // от bySource выше (это сырые цифры ДО QA-фильтра и дедупа
        // против Supabase, почти всегда сильно больше и не показывает,
        // что из этого реально дошло до Telegram).
        const newBySource = {};
        for (const job of newJobs) {
            const key = job.source || "Unknown";
            newBySource[key] = (newBySource[key] || 0) + 1;
        }
        runSummary.newBySource = newBySource;

        if (newJobs.length === 0) {
            logger.info("no new jobs to save or send");

            runSummary.stoppedAt = "dedupe";
            writeRunSummary(runSummary);

            return;
        }

        // ==========================================
        // 5. SAVE TO SUPABASE
        // ==========================================

        logger.info("saving jobs to Supabase...");

        let savedJobs = [];

        try {
            savedJobs = await saveJobs(newJobs);

            logger.info(`saved to Supabase: ${savedJobs.length}`);

            runSummary.saved = savedJobs.length;
        } catch (error) {
            logger.error(`failed to save jobs to Supabase: ${error?.message || error}`);

            runSummary.stoppedAt = "save";
            runSummary.error = error?.message || String(error);
            writeRunSummary(runSummary);

            return;
        }

        // ==========================================
        // 6. TELEGRAM NOTIFICATIONS
        // ==========================================

        logger.info(`sending ${savedJobs.length} Telegram notifications...`);

        let notified = 0;
        let failed = 0;
        let expired = 0;

        for (const job of savedJobs) {
            try {
                // Best-effort проверка "вакансия ещё жива" прямо перед
                // отправкой -- fail-open (любая ошибка проверки = считаем
                // живой), так что она может только пропустить лишнее
                // уведомление про закрытую вакансию, но никогда не
                // заблокирует реальную новую.
                const stillLive = await isVacancyLive(job.url);

                if (!stillLive) {
                    expired++;

                    await markAsExpired(job.id);

                    logger.info(`skipped (looks closed): ${job.company} -- ${job.position}`);

                    continue;
                }

                await sendJob(job);
                await markAsNotified(job.id);

                notified++;

                logger.info(`notified: ${job.company} -- ${job.position}`);
            } catch (error) {
                failed++;

                logger.error(`notification failed: ${job.company} -- ${job.position}: ${error?.message || error}`);
            }
        }

        runSummary.notified = notified;
        runSummary.notificationErrors = failed;
        runSummary.expired = expired;
        runSummary.stoppedAt = "complete";

        // ==========================================
        // 7. FINAL SUMMARY
        // ==========================================

        logger.info("RUN SUMMARY");
        logger.info(`collected: ${collectedJobs.length}`);
        logger.info(`QA jobs: ${qaJobs.length}`);
        logger.info(`unique: ${uniqueJobs.length}`);
        logger.info(`new: ${newJobs.length}`);
        logger.info(`saved: ${savedJobs.length}`);
        logger.info(`notified: ${notified}`);
        logger.info(`skipped as expired: ${expired}`);
        logger.info(`notification errors: ${failed}`);

        writeRunSummary(runSummary);
    } catch (error) {
        logger.error(`fatal error: ${error?.message || error}`);

        runSummary.stoppedAt = "fatal";
        runSummary.error = error?.message || String(error);
        writeRunSummary(runSummary);
    }

    logger.info("AI Job Agent finished");
}

module.exports = {
    processJobs
};
