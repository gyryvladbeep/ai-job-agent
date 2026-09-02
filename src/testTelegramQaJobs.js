const { getTelegramQaJobs } = require("./parsers/telegramQaJobs");

async function test() {
    console.log("🧪 Testing Telegram @qa_jobs parser...\n");

    try {
        const jobs = await getTelegramQaJobs();

        console.log("\n🎯 Total @qa_jobs QA jobs:", jobs.length);

        if (jobs.length === 0) {
            console.log("ℹ️ No QA vacancies found");
        }

    } catch (error) {
        console.error("❌ Test failed:");
        console.error(error);
    }
}

test();