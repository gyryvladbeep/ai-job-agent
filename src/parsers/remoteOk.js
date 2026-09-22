const { runListScraper } = require("../core/listScraper");
const { firstMatchingText } = require("../core/rows");

/*
 * Confirmed via WebFetch (2026-09-22): Remote OK reports 327 results
 * for "Quality Assurance", but this parser was stuck at a flat
 * 49-50/day -- exactly what's rendered on initial load before any
 * scrolling. The rest loads lazily on scroll, same pattern as the
 * Telegram channel widget; the shared scrollUntilStable() helper
 * (see core/pagination.js) now handles that the same way.
 */
const URL = "https://remoteok.com/remote-qa-jobs";

const TITLE_SELECTORS = [
    "h2",
    "h2[itemprop='title']",
    '[itemprop="title"]',
    ".company_and_position h2",
    "a.preventLink h2"
];

const COMPANY_SELECTORS = [
    '[itemprop="hiringOrganization"]',
    '[itemprop="name"]',
    ".companyLink",
    ".company"
];

const DESCRIPTION_SELECTORS = [
    ".description",
    '[itemprop="description"]',
    ".job_description"
];

async function extractJob({ row, cleanText }) {
    let position = await firstMatchingText(row, TITLE_SELECTORS, cleanText);
    let href = null;

    // Fallback: any link into /remote-jobs/ also gives us both the
    // title (if the selectors above missed it) and the href.
    const jobLinks = row.locator('a[href*="/remote-jobs/"]');
    const linkCount = await jobLinks.count();

    for (let i = 0; i < linkCount; i++) {
        const link = jobLinks.nth(i);
        const text = await link.innerText().catch(() => "");
        const candidateHref = await link.getAttribute("href").catch(() => null);

        if (text && candidateHref) {
            if (!position) {
                position = cleanText(text);
            }
            href = candidateHref;
            break;
        }
    }

    if (!position) {
        return null;
    }

    if (!href) {
        const firstLink = row.locator("a").first();

        if (await firstLink.count()) {
            href = await firstLink.getAttribute("href").catch(() => null);
        }
    }

    if (!href) {
        return null;
    }

    const company = (await firstMatchingText(row, COMPANY_SELECTORS, cleanText)) || "Unknown";
    const description = await firstMatchingText(row, DESCRIPTION_SELECTORS, cleanText);
    const fullUrl = new URL(href, "https://remoteok.com").href;

    return { company, position, description, url: fullUrl };
}

async function getRemoteOkJobs() {
    return runListScraper({
        name: "Remote OK",
        slug: "remoteok",
        entryPoints: [
            { id: "remote-qa-jobs", initialUrl: URL }
        ],
        rowSelector: "tr.job",
        pagination: {
            kind: "scroll",
            maxAttempts: 20,
            waitMs: 1000
        },
        waitAfterLoadMs: 3000,
        extractJob
    });
}

module.exports = {
    getRemoteOkJobs
};
