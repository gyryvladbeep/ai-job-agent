const {
    getHabrCareerJobs
} = require("./parsers/habrCareer");

async function test() {
    console.log("🧪 Testing Habr Career parser...\n");

    const jobs = await getHabrCareerJobs();

    console.log("\n🎯 Total Habr Career jobs:", jobs.length);
}

test();