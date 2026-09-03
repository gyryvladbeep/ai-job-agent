const { chromium } = require("playwright");

// FlexJobs' public search results page shows title/company/location
// without a paywall -- the paywall only kicks in on the "apply" step,
// which we never touch since we just link out to the listing.
const FLEXJOBS_URL =
    "https://www.flexjobs.com/search?searchkeyword=QA+Engineer";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getFlexJobsJobs() {
    console.log("🌐 Opening FlexJobs...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        viewport: {
            width: 1440,
            height: 900
        },

        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/151.0.0.0 Safari/537.36"
    });

    try {
        await page.goto(FLEXJOBS_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 FlexJobs page loaded");

        await page.waitForTimeout(3000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        /*
         * Точная вёрстка неизвестна заранее -- пробуем несколько
         * вариантов селекторов карточек вакансий, как и в остальных
         * парсерах. Если ни один не сработает, сохраняем скриншот
         * для отладки вместо тихого падения в 0 результатов.
         */
        const rowSelectors = [
            "[data-job-id]",
            ".job-item",
            "[class*='JobItem']",
            "[class*='job-card']",
            "article"
        ];

        let rows = null;
        let count = 0;

        for (const selector of rowSelectors) {
            const candidate = page.locator(selector);
            const candidateCount = await candidate.count();

            if (candidateCount > 0) {
                rows = candidate;
                count = candidateCount;

                console.log(
                    `📋 Job cards found via "${selector}": ${count}`
                );

                break;
            }
        }

        if (!rows || count === 0) {
            console.log(
                "⚠️ FlexJobs: no job cards found with any known selector"
            );

            await page.screenshot({
                path: "flexjobs-debug.png",
                fullPage: true
            });

            console.log("📸 Screenshot saved: flexjobs-debug.png");

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const card = rows.nth(i);

                let position = "";

                const titleSelectors = [
                    "h2",
                    "h3",
                    "[class*='title']",
                    "a"
                ];

                for (const selector of titleSelectors) {
                    const locator = card.locator(selector).first();

                    if (await locator.count()) {
                        const text = await locator
                            .innerText()
                            .catch(() => "");

                        if (text && text.trim()) {
                            position = cleanText(text);
                            break;
                        }
                    }
                }

                if (!position) {
                    console.log(`⚠️ Card ${i}: title not found`);
                    continue;
                }

                let href = null;

                const link = card.locator("a").first();

                if (await link.count()) {
                    href = await link
                        .getAttribute("href")
                        .catch(() => null);
                }

                if (!href) {
                    console.log(`⚠️ Card ${i}: URL not found`);
                    continue;
                }

                let company = "Unknown";

                const companySelectors = [
                    "[class*='company']",
                    "[class*='Company']",
                    "[class*='employer']"
                ];

                for (const selector of companySelectors) {
                    const locator = card.locator(selector).first();

                    if (await locator.count()) {
                        const text = await locator
                            .innerText()
                            .catch(() => "");

                        if (text && text.trim()) {
                            company = cleanText(text);
                            break;
                        }
                    }
                }

                const description = cleanText(
                    await card.innerText().catch(() => "")
                );

                const fullUrl = new URL(
                    href,
                    "https://www.flexjobs.com"
                ).href;

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "FlexJobs"
                });
            } catch (error) {
                console.log(`⚠️ FlexJobs card ${i} parse failed`);
                console.log(error?.message || error);
            }
        }

        const uniqueJobs = [
            ...new Map(jobs.map((job) => [job.url, job])).values()
        ];

        console.log("");
        console.log(`🎯 FlexJobs jobs collected: ${uniqueJobs.length}`);
        console.table(uniqueJobs);

        return uniqueJobs;
    } catch (error) {
        console.error("❌ FlexJobs parser error:");
        console.error(error?.message || error);

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getFlexJobsJobs
};
