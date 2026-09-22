const { runListScraper } = require("../core/listScraper");
const { firstMatchingText } = require("../core/rows");

/*
 * Ministry of Testing is a QA/testing-specific community job board
 * -- every listing here is already testing-relevant by construction,
 * unlike the general boards where most of the page has nothing to
 * do with QA. robots.txt checked directly: /jobs isn't disallowed
 * for general crawlers, only /admin and a handful of known scraper
 * bots by name. Single page, no pagination confirmed needed here.
 */
const URL = "https://www.ministryoftesting.com/jobs";

const ROW_SELECTORS = [
    "a[href*='/jobs/']:not([href$='/jobs/'])",
    "[class*='JobCard']",
    "[class*='job-card']",
    "article",
    "li[class*='job']"
];

const TITLE_SELECTORS = ["h2", "h3", "[class*='title']"];
const COMPANY_SELECTORS = ["[class*='company']", "[class*='Company']", "[class*='employer']"];

async function extractJob({ row, cleanText }) {
    let href = await row.getAttribute("href").catch(() => null);

    if (!href) {
        const link = row.locator("a").first();

        if (await link.count()) {
            href = await link.getAttribute("href").catch(() => null);
        }
    }

    if (!href) {
        return null;
    }

    let position = await firstMatchingText(row, TITLE_SELECTORS, cleanText);

    if (!position) {
        position = cleanText(await row.innerText().catch(() => "")).slice(0, 120);
    }

    if (!position) {
        return null;
    }

    const company = (await firstMatchingText(row, COMPANY_SELECTORS, cleanText)) || "Unknown";
    const description = cleanText(await row.innerText().catch(() => ""));
    const fullUrl = new URL(href, "https://www.ministryoftesting.com").href;

    return { company, position, description, url: fullUrl };
}

async function getMinistryOfTestingJobs() {
    return runListScraper({
        name: "Ministry of Testing",
        slug: "ministryoftesting",
        entryPoints: [
            { id: "jobs", initialUrl: URL }
        ],
        rowSelector: ROW_SELECTORS,
        pagination: {
            kind: "scroll",
            maxAttempts: 0
        },
        waitAfterLoadMs: 2500,
        browserOptions: { viewport: { width: 1440, height: 900 } },
        extractJob
    });
}

module.exports = {
    getMinistryOfTestingJobs
};
