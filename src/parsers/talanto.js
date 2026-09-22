const { runListScraper } = require("../core/listScraper");
const { clickNextPager } = require("../core/pagination");

/*
 * Talanto's daily search has a second results page (confirmed via
 * WebFetch, 2026-09-22) that was never read. Its exact pagination
 * URL parameter isn't published, so rather than guess one, this
 * clicks whatever "next page" control is actually in the DOM.
 */
const URL =
    "https://talanto.work/?sort=newest&period=day&offset=0&search_in=title&q=Qa+engineer";

const NEXT_PAGE_SELECTORS = [
    'a[aria-label="Next page"]',
    'a[aria-label="Next"]',
    'button[aria-label="Next page"]',
    'a[rel="next"]',
    'nav[aria-label*="agination"] a:has-text("2")',
    'a:has-text("»")'
];

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[ё]/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}

function isPremiumCard(text) {
    const normalized = normalize(text);

    const premiumKeywords = [
        "premium",
        "talanto boost",
        "boost vacancy",
        "подписк",
        "только по подписке"
    ];

    if (premiumKeywords.some(keyword => normalized.includes(keyword))) {
        return true;
    }

    // Вакансии, доступные только по подписке, помечаются звёздочкой
    // (*) прямо в названии/карточке вместо текстового лейбла.
    return String(text || "").includes("*");
}

function parseCompanyAndPosition(label) {
    const separatorIndex = label.indexOf(": ");

    if (separatorIndex === -1) {
        return { company: "Unknown", position: label.trim() };
    }

    return {
        company: label.substring(0, separatorIndex).trim(),
        position: label.substring(separatorIndex + 2).trim()
    };
}

async function extractJob({ row, logger }) {
    const cardText = await row.innerText().catch(() => "");

    // Premium/Boost вакансии пропускаем ДО регистрации URL -- как в
    // оригинале, чтобы страница, целиком состоящая из premium-карточек,
    // не путалась с "новых карточек больше нет".
    if (isPremiumCard(cardText)) {
        return null;
    }

    const jobLink = row.locator("a[aria-label]").first();
    const link = await jobLink.getAttribute("href").catch(() => null);
    const label = await jobLink.getAttribute("aria-label").catch(() => null);

    if (!link || !label) {
        return null;
    }

    const fullUrl = new URL(link, "https://talanto.work").href;
    const { company, position } = parseCompanyAndPosition(label);

    if (!position) {
        return null;
    }

    return { company, position, description: cardText || "", url: fullUrl };
}

async function getTalantoJobs() {
    return runListScraper({
        name: "Talanto",
        slug: "talanto",
        entryPoints: [
            { id: "qa-engineer-daily", initialUrl: URL }
        ],
        rowSelector: "article",
        pagination: {
            kind: "paged",
            maxPages: 5,
            advance: clickNextPager(NEXT_PAGE_SELECTORS)
        },
        waitAfterLoadMs: 3000,
        // Talanto has historically needed a real (non-headless)
        // browser with a slight action delay -- kept as-is from the
        // original parser rather than "fixed" without evidence it's
        // safe to change.
        browserOptions: { headless: false, slowMo: 100 },
        extractJob
    });
}

module.exports = {
    getTalantoJobs
};
