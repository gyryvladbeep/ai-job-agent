const {
    getTelegramQaJobs
} = require("./parsers/telegramQaChillout");

async function test() {
    console.log("🧪 Testing Telegram QA parser...\n");

    const jobs = await getTelegramQaJobs();

    console.table(
        jobs.map(job => ({
            company: job.company,
            position: job.position,
            source: job.source,
            url: job.url
        }))
    );

    console.log(
        `\n🎯 Total Telegram jobs: ${jobs.length}`
    );
}

test();