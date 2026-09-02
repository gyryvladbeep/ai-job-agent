const { getItaJobs } = require("./parsers/itaJobs");

async function test() {

    console.log("🧪 Testing ITA Jobs Matches parser...");
    console.log("");

    try {

        const jobs = await getItaJobs();

        console.log("");
        console.log(
            `🎯 Total ITA Matches: ${jobs.length}`
        );

    } catch (error) {

        console.error("❌ Test failed:");
        console.error(error);
    }
}

test();