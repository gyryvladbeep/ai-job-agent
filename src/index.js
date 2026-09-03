require("dotenv").config();

const { getTalantoJobs } = require("./parsers/talanto");
const { getTelegramWebJobs } = require("./parsers/telegramWeb");
const { getHabrCareerJobs } = require("./parsers/habrCareer");
const { getGeekJobJobs } = require("./parsers/geekjob");
const { getItaJobs } = require("./parsers/itaJobs");
const { getRemoteOkJobs } = require("./parsers/remoteOk");
const { getWellfoundJobs } = require("./parsers/wellfound");
const { getWorkingNomadsJobs } = require("./parsers/workingNomads");
const { getFlexJobsJobs } = require("./parsers/flexJobs");
const {
    getWeWorkRemotelyJobs
} = require("./parsers/weWorkRemotely");

const {
    jobExists,
    saveJobs,
    markAsNotified
} = require("./services/supabase");

const { sendJob } = require("./services/telegram");

const { filterQaJobs } = require("./utils/qaFilter");


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

    console.log("");
    console.log(
        "🔎 Collecting vacancies from all sources..."
    );
    console.log("");

    const allJobs = [];


    // ==========================================
    // 1. TALANTO
    // ==========================================

    const talantoJobs =
        await collectFromSource(
            "Talanto",
            getTalantoJobs
        );

    allJobs.push(...talantoJobs);


    // ==========================================
    // 2. TELEGRAM
    // ==========================================

    const telegramJobs =
        await collectFromSource(
            "Telegram",
            getTelegramWebJobs
        );

    allJobs.push(...telegramJobs);


    // ==========================================
    // 3. HABR CAREER
    // ==========================================

    const habrJobs =
        await collectFromSource(
            "Habr Career",
            getHabrCareerJobs
        );

    allJobs.push(...habrJobs);


    // ==========================================
    // 4. GEEKJOB
    // ==========================================

    const geekJobJobs =
        await collectFromSource(
            "GeekJob",
            getGeekJobJobs
        );

    allJobs.push(...geekJobJobs);


    // ==========================================
    // 5. ITA JOBS
    // ==========================================

    const itaJobs =
        await collectFromSource(
            "ITA Jobs",
            getItaJobs
        );

    allJobs.push(...itaJobs);



    // ==========================================
    // 7. REMOTE OK
    // ==========================================

    const remoteOkJobs =
        await collectFromSource(
            "Remote OK",
            getRemoteOkJobs
        );

    allJobs.push(...remoteOkJobs);


    // ==========================================
    // 8. WELLFOUND
    // ==========================================

    const wellfoundJobs =
        await collectFromSource(
            "Wellfound",
            getWellfoundJobs
        );

    allJobs.push(...wellfoundJobs);


    // ==========================================
    // 9. WE WORK REMOTELY
    // ==========================================

    const wwrJobs =
        await collectFromSource(
            "We Work Remotely",
            getWeWorkRemotelyJobs
        );

    allJobs.push(...wwrJobs);

    // ==========================================
    // 10. WORKING NOMADS
    // ==========================================

    const workingNomadsJobs =
        await collectFromSource(
            "Working Nomads",
            getWorkingNomadsJobs
        );

    allJobs.push(...workingNomadsJobs);


    // ==========================================
    // 11. FLEXJOBS
    // ==========================================

    const flexJobsJobs =
        await collectFromSource(
            "FlexJobs",
            getFlexJobsJobs
        );

    allJobs.push(...flexJobsJobs);


    // ==========================================
    // TOTAL
    // ==========================================

    console.log("");
    console.log("================================");
    console.log(
        `📦 TOTAL COLLECTED: ${allJobs.length}`
    );
    console.log("================================");

    return allJobs;
}


async function processJobs() {

    console.log("");
    console.log("🚀 AI Job Agent started");
    console.log("================================");


    try {

        // ==========================================
        // 1. COLLECT
        // ==========================================

        const collectedJobs =
            await collectJobs();


        if (collectedJobs.length === 0) {

            console.log("");
            console.log(
                "ℹ️ No jobs collected from any source"
            );

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


        if (qaJobs.length === 0) {

            console.log(
                "ℹ️ No QA jobs after filtering"
            );

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


        if (newJobs.length === 0) {

            console.log(
                "ℹ️ No new jobs to save or send"
            );

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

        } catch (error) {

            console.error(
                "❌ Failed to save jobs to Supabase"
            );

            console.error(
                error?.message || error
            );

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


    } catch (error) {

        console.error("");
        console.error(
            "❌ AI Job Agent fatal error:"
        );

        console.error(
            error?.message || error
        );
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
