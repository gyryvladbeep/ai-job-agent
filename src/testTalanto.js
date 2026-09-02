const { getTalantoJobs } = require("./parsers/talanto");

async function test() {
    console.log("🧪 Testing Talanto parser...\n");

    try {
        const jobs = await getTalantoJobs();

        console.log("\n🎯 Total Talanto QA jobs:", jobs.length);

        if (jobs.length > 0) {
            console.table(jobs);
        } else {
            console.log("ℹ️ No QA vacancies found for the last 24 hours.");
        }

    } catch (error) {
        console.error("❌ Test failed:");
        console.error(error);
    }
}

test();