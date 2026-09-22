const { runListScraper } = require("../core/listScraper");

/*
 * A personal ITA Jobs "matches" page -- already scoped/curated for
 * one candidate, so unlike the general boards there's no per-item
 * QA filtering to do here; the global qaFilter pass downstream in
 * src/index.js is what applies to this source. Single page, no
 * pagination.
 */
const URL = "https://jobs.ita.am/matches/0812dfe0-f7f6-46b8-af84-178ca9fd843a";

const SKIP_LABELS = new Set(["Matches", "Skip to content"]);

async function extractJob({ row, cleanText }) {
    const href = await row.getAttribute("href").catch(() => null);
    const text = await row.innerText().catch(() => "");

    if (!href || !text) {
        return null;
    }

    const position = cleanText(text);

    if (!position || SKIP_LABELS.has(position)) {
        return null;
    }

    const fullUrl = new URL(href, "https://jobs.ita.am").href;

    return {
        company: "Unknown",
        position,
        description: "",
        url: fullUrl
    };
}

async function getItaJobs() {
    return runListScraper({
        name: "ITA Jobs Matches",
        slug: "ita-matches",
        entryPoints: [
            { id: "matches", initialUrl: URL }
        ],
        rowSelector: "a",
        pagination: {
            kind: "scroll",
            maxAttempts: 0
        },
        waitAfterLoadMs: 5000,
        browserOptions: { viewport: { width: 1440, height: 1000 } },
        extractJob
    });
}

module.exports = {
    getItaJobs
};
