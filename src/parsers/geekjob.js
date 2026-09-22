const { runListScraper } = require("../core/listScraper");
const { urlParamPager } = require("../core/pagination");

/*
 * GeekJob confirmed (WebFetch, 2026-09-22) to have 222 open
 * vacancies across 12 listing pages -- previously this parser only
 * ever read page 1 and, separately, had no User-Agent set at all
 * (the only parser missing one), which likely triggered anti-bot
 * blocking of page.goto() itself. Both are fixed by going through
 * the shared core: launchPage() always sets a realistic UA/viewport,
 * and pagination now actually walks all 12 pages.
 */
const BASE_URL = "https://geekjob.ru/vacancies";

function buildPageUrl(pageNum) {
    return pageNum > 1 ? `${BASE_URL}?page=${pageNum}` : BASE_URL;
}

async function extractJob({ row, cleanText }) {
    const href = await row.getAttribute("href").catch(() => null);
    const text = await row.innerText().catch(() => "");

    if (!href || !text) {
        return null;
    }

    const fullUrl = href.startsWith("http")
        ? href
        : `https://geekjob.ru${href}`;

    return {
        company: "Unknown",
        position: cleanText(text),
        description: "",
        url: fullUrl
    };
}

async function getGeekJobJobs() {
    return runListScraper({
        name: "GeekJob",
        slug: "geekjob",
        entryPoints: [
            { id: "vacancies", initialUrl: buildPageUrl(1) }
        ],
        rowSelector: 'a[href*="/vacancy/"]',
        pagination: {
            kind: "paged",
            maxPages: 12,
            advance: urlParamPager(buildPageUrl)
        },
        waitAfterLoadMs: 2000,
        extractJob,
        // Оставляем pageNum1 URL homepage-разогрев перед основным
        // списком -- так делал оригинальный парсер, не убираем без
        // причины, стоит копейки по времени.
        beforeAll: async (page, logger) => {
            try {
                await page.goto("https://geekjob.ru/", {
                    waitUntil: "domcontentloaded",
                    timeout: 30000
                });
                await page.waitForTimeout(2000);
            } catch (error) {
                logger.warn(`failed to open homepage: ${error?.message || error}`);
            }
        }
    });
}

module.exports = {
    getGeekJobJobs
};
