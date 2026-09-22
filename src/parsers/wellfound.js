const { runListScraper } = require("../core/listScraper");
const { urlParamPager } = require("../core/pagination");

/*
 * Confirmed via WebFetch (2026-09-22): "229 results total / Page 1
 * of 9" for the QA Engineer role search -- this parser previously
 * only ever read page 1. Also confirmed the day-9 URL fix from an
 * earlier session (moved off a broken ?query=QA%20Engineer search
 * that returned 0 results onto the dedicated /role/r/qa-engineer
 * listing, which is the source of the ~24/day figure this parser
 * had been stuck at) -- that part stays, list us in Habr
 * Career/GeekJob's company, it just needed real pagination added.
 */
const BASE_URL = "https://wellfound.com/role/r/qa-engineer";

function buildPageUrl(pageNum) {
    return pageNum === 1 ? BASE_URL : `${BASE_URL}?page=${pageNum}`;
}

async function extractJob({ row, cleanText }) {
    const href = await row.getAttribute("href").catch(() => null);
    const text = await row.innerText().catch(() => "");

    if (!href) {
        return null;
    }

    const position = cleanText(text);

    // Guards against picking up stray short/non-title links inside
    // a card that also happens to match the row selector.
    if (position.length < 3) {
        return null;
    }

    const fullUrl = new URL(href, "https://wellfound.com").href;

    // Wellfound renders the whole card's text as siblings of the
    // title link rather than a dedicated "company" element, so we
    // walk up to the nearest ancestor card and pick the first other
    // line that looks like a company name (short, not the title).
    let company = "Unknown";

    const card = row.locator(
        "xpath=ancestor::*[self::div or self::li][1]"
    );

    if (await card.count()) {
        const cardText = await card.innerText().catch(() => "");

        const lines = cardText
            .split("\n")
            .map(cleanText)
            .filter(Boolean);

        for (const line of lines) {
            if (line !== position && line.length > 1 && line.length < 100) {
                company = line;
                break;
            }
        }
    }

    return {
        company,
        position,
        description: "",
        url: fullUrl
    };
}

async function getWellfoundJobs() {
    return runListScraper({
        name: "Wellfound",
        slug: "wellfound",
        entryPoints: [
            { id: "qa-engineer", initialUrl: buildPageUrl(1) }
        ],
        rowSelector: 'a[href*="/jobs/"]',
        pagination: {
            kind: "paged",
            maxPages: 9,
            advance: urlParamPager(buildPageUrl)
        },
        waitAfterLoadMs: 4000,
        extractJob
    });
}

module.exports = {
    getWellfoundJobs
};
