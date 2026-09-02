const {
    getRemoteOkJobs
} = require("./parsers/remoteOk");

async function test() {

    console.log(
        "🧪 Testing Remote OK parser..."
    );

    try {

        const jobs =
            await getRemoteOkJobs();

        console.log("");

        console.log(
            `🎯 Total Remote OK jobs: ${jobs.length}`
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