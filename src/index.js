require("dotenv").config();

const { getTalantoJobs } = require("./parsers/talanto");
const { getTelegramWebJobs } = require("./parsers/telegramWeb");
const { getHabrCareerJobs } = require("./parsers/habrCareer");
const { getGeekJobJobs } = require("./parsers/geekjob");
const { getItaJobs } = require("./parsers/itaJobs");
const { getRemoteOkJobs } = require("./parsers/remoteOk");
const { getWellfoundJobs } = require("./parsers/wellfound");
const { getWorkingNomadsJobs } = require("./parsers/workingNomads");
const {
    getMinistryOfTestingJobs
} = require("./parsers/ministryOfTesting");

const {
    jobExists,
    saveJobs,
    markAsNotified
} = require("./services/supabase");

const { sendJob } = require("./services/telegram");

const { filterQaJobs } = require("./utils/qaFilter");

const { writeRunSummary } = require("./services/runLog");


async function collectFromSource(name, parser) {

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 Starting source: ${name}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {

        const jobs = await parser();

        console.log(
            `✅ ${name}: ${jobs.length} jobs collected`
        );

        return jobs;

    } catch (error) {

        console.error(
            `❌ ${name} parser failed`
        );

        console.error(
            error?.message || error
        );

        console.log(
            "⚠️ Continuing with other sources..."
        );

        return [];
    }
}


async function collectJobs() {

    // ==========================================
    // SOURCES
    // ==========================================
    //
    // One entry per source -- add/remove a source here only, instead
    // of a whole copy-pasted block. Order is just display order.
    // ==========================================

    const SOURCES = [
        { name: "Talanto", parser: getTalantoJobs },
        { name: "Telegram", parser: getTelegramWebJobs },
        { name: "Habr Career", parser: getHabrCareerJobs },
        { name: "GeekJob", parser: getGeekJobJobs },
        { name: "ITA Jobs", parser: getItaJobs },
        { name: "Remote OK", parser: getRemoteOkJobs },
        { name: "Wellfound", parser: getWellfoundJobs },
        { name: "Working Nomads", parser: getWorkingNomadsJobs },
        { name: "Ministry of Testing", parser: getMinistryOfTestingJobs }
    ];

    console.log("");
    console.log(
        "🔎 Collecting vacancies from all sources..."
    );
    console.log("");

    const allJobs = [];
    const bySource = {};

    for (const { name, parser } of SOURCES) {
        const jobs = await collectFromSource(name, parser);

        bySource[name] = jobs.length;

        allJobs.push(...jobs);
    }

    console.log("");
    console.log("================================");
    console.log(
        `📦 TOTAL COLLECTED: ${allJobs.length}`
    );
    console.log("================================");

    return { allJobs, bySource };
}

async function processJobs() {

    console.log("");
    console.log("🚀 AI Job Agent started");
    console.log("================================");

    // Filled in as we go, written to logs/ no matter where the run
    // stops -- see src/services/runLog.js. This is what lets a run's
    // numbers be inspected later without having watched the terminal
    // when the scheduler fired.
    const runSummary = {
        bySource: {},
        newBySource: {},
        collected: 0,
        qaFiltered: 0,
        unique: 0,
        new: 0,
        saved: 0,
        notified: 0,
        notificationErrors: 0,
        stoppedAt: "started",
        error: null
    };

    try {

        // ==========================================
        // 1. COLLECT
        // ==========================================

        const { allJobs: collectedJobs, bySource } =
            await collectJobs();

        runSummary.bySource = bySource;
        runSummary.collected = collectedJobs.length;

        if (collectedJobs.length === 0) {

            console.log("");
            console.log(
                "ℹ️ No jobs collected from any source"
            );

            runSummary.stoppedAt = "collect";
            writeRunSummary(runSummary);

            return;
        }


        // ==========================================
        // 2. QA FILTER
        // ==========================================

        console.log("");
        console.log(
            "🔎 Applying QA filter..."
        );

        const qaJobs =
            filterQaJobs(
                collectedJobs
            );

        console.log(
            `🎯 QA jobs after filtering: ${qaJobs.length}`
        );

        runSummary.qaFiltered = qaJobs.length;


        if (qaJobs.length === 0) {

            console.log(
                "ℹ️ No QA jobs after filtering"
            );

            runSummary.stoppedAt = "qaFilter";
            writeRunSummary(runSummary);

            return;
        }


        // ==========================================
        // 3. REMOVE DUPLICATES
        // ==========================================

        console.log("");
        console.log(
            "🧹 Removing duplicates..."
        );

        const uniqueJobs = [
            ...new Map(
                qaJobs.map(job => [
                    job.url,
                    job
                ])
            ).values()
        ];

        console.log(
            `🧹 Unique jobs: ${uniqueJobs.length}`
        );

        runSummary.unique = uniqueJobs.length;


        // ==========================================
        // 4. CHECK SUPABASE
        // ==========================================

        console.log("");
        console.log(
            "🗄️ Checking Supabase..."
        );

        const newJobs = [];


        for (const job of uniqueJobs) {

            try {

                const exists =
                    await jobExists(
                        job.url
                    );


                if (exists) {

                    console.log(
                        `⏭️ Already exists: ${job.company} — ${job.position}`
                    );

                    continue;
                }


                newJobs.push(job);

            } catch (error) {

                console.error(
                    `❌ Supabase check failed for: ${job.position}`
                );

                console.error(
                    error?.message || error
                );
            }
        }


        console.log("");

        console.log(
            `🆕 New jobs found: ${newJobs.length}`
        );

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

            console.log(
                "ℹ️ No new jobs to save or send"
            );

            runSummary.stoppedAt = "dedupe";
            writeRunSummary(runSummary);

            return;
        }


        // ==========================================
        // 5. SAVE TO SUPABASE
        // ==========================================

        console.log("");
        console.log(
            "💾 Saving jobs to Supabase..."
        );

        let savedJobs = [];


        try {

            savedJobs =
                await saveJobs(
                    newJobs
                );

            console.log(
                `💾 Saved to Supabase: ${savedJobs.length}`
            );

            runSummary.saved = savedJobs.length;

        } catch (error) {

            console.error(
                "❌ Failed to save jobs to Supabase"
            );

            console.error(
                error?.message || error
            );

            runSummary.stoppedAt = "save";
            runSummary.error = error?.message || String(error);
            writeRunSummary(runSummary);

            return;
        }


        // ==========================================
        // 6. TELEGRAM NOTIFICATIONS
        // ==========================================

        console.log("");
        console.log(
            `📨 Sending ${savedJobs.length} Telegram notifications...`
        );


        let notified = 0;
        let failed = 0;


        for (const job of savedJobs) {

            try {

                await sendJob(job);


                await markAsNotified(
                    job.id
                );


                notified++;


                console.log(
                    `✅ Notified: ${job.company} — ${job.position}`
                );

            } catch (error) {

                failed++;


                console.error(
                    `❌ Notification failed: ${job.company} — ${job.position}`
                );

                console.error(
                    error?.message || error
                );
            }
        }

        runSummary.notified = notified;
        runSummary.notificationErrors = failed;
        runSummary.stoppedAt = "complete";


        // ==========================================
        // 7. FINAL SUMMARY
        // ==========================================

        console.log("");
        console.log("================================");
        console.log("📊 RUN SUMMARY");
        console.log("================================");

        console.log(
            `📦 Collected: ${collectedJobs.length}`
        );

        console.log(
            `🎯 QA jobs: ${qaJobs.length}`
        );

        console.log(
            `🧹 Unique: ${uniqueJobs.length}`
        );

        console.log(
            `🆕 New: ${newJobs.length}`
        );

        console.log(
            `💾 Saved: ${savedJobs.length}`
        );

        console.log(
            `📨 Notified: ${notified}`
        );

        console.log(
            `❌ Notification errors: ${failed}`
        );

        console.log("================================");

        writeRunSummary(runSummary);


    } catch (error) {

        console.error("");
        console.error(
            "❌ AI Job Agent fatal error:"
        );

        console.error(
            error?.message || error
        );

        runSummary.stoppedAt = "fatal";
        runSummary.error = error?.message || String(error);
        writeRunSummary(runSummary);
    }


    console.log("");
    console.log(
        "🏁 AI Job Agent finished"
    );
    console.log("");
}


module.exports = {
    processJobs,
};
