const { runListScraper } = require("../core/listScraper");
const { firstMatchingText } = require("../core/rows");

/*
 * Same exact-same-count-every-day symptom as Remote OK (flat 51/day)
 * -- likely an Angular app (ng-binding markup) lazy-loading rows on
 * scroll. Same shared scrollUntilStable() fix.
 */
const URL = "https://www.workingnomads.com/remote-qa-jobs";

// Подтверждено вручную (workingnomads-debug.html из прошлой сессии):
// каждая карточка -- это сам <a id="job-N" class="job-desktop ...">,
// а не обёртка с вложенной ссылкой. Остальные варианты оставлены
// вторым/третьим приоритетом на случай смены вёрстки.
const ROW_SELECTORS = [
    "a.job-desktop",
    "li.job",
    ".jobs-list li",
    "[class*='job-list'] li",
    "[class*='JobListing']"
];

const TITLE_SELECTORS = ["h4", "h2", "h3", ".title", "[class*='title']", "a"];
const COMPANY_SELECTORS = [".company", "[class*='company']", "[class*='Company']"];

async function extractJob({ row, cleanText }) {
    const position = await firstMatchingText(row, TITLE_SELECTORS, cleanText);

    if (!position) {
        return null;
    }

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

    const company = (await firstMatchingText(row, COMPANY_SELECTORS, cleanText)) || "Unknown";
    const description = cleanText(await row.innerText().catch(() => ""));
    const fullUrl = new URL(href, "https://www.workingnomads.com").href;

    return { company, position, description, url: fullUrl };
}

async function getWorkingNomadsJobs() {
    return runListScraper({
        name: "Working Nomads",
        slug: "workingnomads",
        entryPoints: [
            { id: "remote-qa-jobs", initialUrl: URL }
        ],
        rowSelector: ROW_SELECTORS,
        pagination: {
            kind: "scroll",
            maxAttempts: 20,
            waitMs: 1000
        },
        waitAfterLoadMs: 3000,
        browserOptions: { viewport: { width: 1440, height: 900 } },
        extractJob
    });
}

module.exports = {
    getWorkingNomadsJobs
};
