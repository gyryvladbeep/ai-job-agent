const { runListScraper } = require("../core/listScraper");
const { urlParamPager } = require("../core/pagination");
const { isQaJob } = require("../utils/qaFilter");

/*
 * Two categories, each paginated and deduped independently (a QA
 * job could otherwise appear identically in both) -- this already
 * walked multiple pages per category (an earlier fix), it just
 * hadn't been folded into the shared core yet. Filters locally
 * against the canonical QA classifier (see src/utils/qaFilter.js)
 * so pagination can stop based on genuinely new links per page
 * while the final job list only contains QA-relevant postings;
 * this used to keep its own separate keyword list that had quietly
 * drifted from the other three copies across the codebase.
 */
const CATEGORIES = [
    "testirovshik",
    "testirovschik_mobilnyh_prilozheniy"
];

const MAX_PAGES_PER_CATEGORY = 6;

function buildPageUrl(pageNum, entryPoint) {
    const base = `https://career.habr.com/vacancies/${entryPoint.id}/full_time`;
    return pageNum > 1 ? `${base}?page=${pageNum}` : base;
}

async function extractJob({ row, cleanText }) {
    const href = await row.getAttribute("href").catch(() => null);
    const text = await row.innerText().catch(() => "");

    if (!href || !text) {
        return null;
    }

    // Только реальные ссылки на вакансии, не служебные /vacancies/... .
    const isRealVacancyLink =
        /^\/vacancies\/\d+/.test(href) ||
        /^https:\/\/career\.habr\.com\/vacancies\/\d+/.test(href);

    if (!isRealVacancyLink) {
        return null;
    }

    const position = cleanText(text);
    const fullUrl = href.startsWith("http") ? href : `https://career.habr.com${href}`;

    let company = "Unknown";

    const card = row.locator(
        "xpath=ancestor::*[contains(@class, 'vacancy-card')][1]"
    );

    if (await card.count()) {
        const companyLink = card.locator('a[href*="/companies/"]').first();

        if (await companyLink.count()) {
            const companyText = await companyLink.innerText().catch(() => "");

            if (companyText && companyText.trim()) {
                company = cleanText(companyText);
            }
        }
    }

    return { company, position, description: "", url: fullUrl };
}

async function getHabrCareerJobs() {
    return runListScraper({
        name: "Habr Career",
        slug: "habr-career",
        entryPoints: CATEGORIES.map(category => ({
            id: category,
            initialUrl: buildPageUrl(1, { id: category })
        })),
        rowSelector: 'a[href*="/vacancies/"]',
        pagination: {
            kind: "paged",
            maxPages: MAX_PAGES_PER_CATEGORY,
            advance: urlParamPager(buildPageUrl)
        },
        waitAfterLoadMs: 1500,
        extractJob,
        filterLocally: isQaJob
    });
}

module.exports = {
    getHabrCareerJobs
};
