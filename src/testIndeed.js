const {
    getIndeedJobs
} = require("./parsers/indeed");

async function test() {

    console.log(
        "🧪 Testing Indeed parser..."
    );

    try {

        const jobs =
            await getIndeedJobs();

        console.log("");

        console.log(
            `🎯 Total Indeed QA jobs: ${jobs.length}`
        );

    } catch (error) {

        console.error(
            "❌ Test failed:"
        );

        console.error(
            error
        );
    }
}

test();