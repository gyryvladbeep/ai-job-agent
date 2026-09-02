const {
    getGeekJobJobs
} = require("./parsers/geekjob");

async function test() {
    console.log("🧪 Testing GeekJob parser...");

    try {
        const jobs = await getGeekJobJobs();

        console.log("");
        console.log(`🎯 Total GeekJob QA jobs: ${jobs.length}`);
    } catch (error) {
        console.error("❌ Test error:");
        console.error(error);
    }
}

test();