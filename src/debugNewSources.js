require("dotenv").config();

const { getWorkingNomadsJobs } = require("./parsers/workingNomads");

// Standalone test for sources that are still being tuned -- doesn't
// touch Supabase or Telegram, so it's safe to re-run while iterating
// on selectors. FlexJobs was dropped (see README Roadmap): it served
// a completely blank page to headless Playwright, same bot-block
// class as Indeed/Glassdoor, so there was nothing left to select.
(async () => {
    console.log("=== Working Nomads ===");
    const wn = await getWorkingNomadsJobs();
    console.log(`Working Nomads count: ${wn.length}`);
})();
