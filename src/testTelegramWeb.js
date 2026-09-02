const { getTelegramWebJobs } = require("./parsers/telegramWeb");

async function test() {
    console.log("🧪 Testing Telegram Web parser...\n");

    try {
        const jobs = await getTelegramWebJobs();

        console.log("\n==============================");
        console.log(`🎯 TOTAL: ${jobs.length} QA vacancies`);
        console.log("==============================\n");

    } catch (error) {
        console.error("❌ Test failed:");
        console.error(error);
    }
}

test();