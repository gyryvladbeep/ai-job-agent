const {
    getWeWorkRemotelyJobs
} = require("./parsers/weWorkRemotely");

async function test() {
    console.log(
        "🧪 Testing We Work Remotely parser..."
    );

    try {
        const jobs =
            await getWeWorkRemotelyJobs();

        console.log("");

        console.log(
            `🎯 Total We Work Remotely jobs: ${jobs.length}`
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