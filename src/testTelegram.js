require("dotenv").config();

const { sendJob } = require("./services/telegram");

async function main() {
    console.log("🧪 Testing job notification...");

    const testJob = {
        company: "SoftSwiss",
        position: "QA Engineer",
        source: "Talanto",
        url: "https://talanto.work/"
    };

    await sendJob(testJob);

    console.log("🏁 Test finished");
}

main();