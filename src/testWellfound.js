const {
    getWellfoundJobs
} = require("./parsers/wellfound");

async function test() {
    console.log(
        "🧪 Testing Wellfound parser..."
    );

    try {
        const jobs =
            await getWellfoundJobs();

        console.log("");

        console.log(
            `🎯 Total Wellfound jobs: ${jobs.length}`
        );

        console.table(jobs);

    } catch (error) {
        console.error(
            "❌ Test failed:"
        );

        console.error(error);
    }
}

test();