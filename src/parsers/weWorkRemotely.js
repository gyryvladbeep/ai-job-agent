const { chromium } = require("playwright");
const fs = require("fs");

/*
 * A single search for "QA" returns ZERO results on WWR's own site --
 * confirmed by inspecting weworkremotely.com/remote-jobs/search?term=QA
 * directly (it renders "There aren't any jobs that match your search"
 * and suggests trying broader/different keywords). Rather than gamble
 * on one term, we search a handful of terms that cover how QA roles
 * are actually titled and merge+dedupe the results by URL. The shared
 * QA filter (src/utils/qaFilter.js) still runs on the combined output
 * afterwards, so a broad match here is safe.
 */
const SEARCH_TERMS = ["QA", "Test Engineer", "Quality Assurance", "SDET"];

function wwrSearchUrl(term) {
    return (
        "https://weworkremotely.com/remote-jobs/search?term=" +
        encodeURIComponent(term)
    );
}

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function searchOneTerm(page, term) {
    const url = wwrSearchUrl(term);

    console.log(`🌐 We Work Remotely: searching "${term}"...`);

    await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000
    });

    await page.waitForTimeout(2000);

    console.log(`🔗 Current URL: ${page.url()}`);

    const jobItems = page.locator(
        "section.jobs article"
    );

    let count = await jobItems.count();

    /*
     * Запасной селектор, если структура страницы
     * отличается.
     */
    if (count === 0) {
        count = await page.locator(
            "article"
        ).count();
    }

    console.log(
        `📋 "${term}": ${count} job cards found`
    );

    if (count === 0) {
        return [];
    }

    const jobs = [];

    for (let i = 0; i < count; i++) {
        try {
            const card = jobItems.nth(i);

            const link = card.locator("a").first();

            const href = await link
                .getAttribute("href")
                .catch(() => null);

            if (!href) {
                console.log(`⚠️ Card ${i}: URL not found`);
                continue;
            }

            const fullUrl = new URL(
                href,
                "https://weworkremotely.com"
            ).href;

            const titleSelectors = [
                "h2",
                "h3",
                ".title",
                ".job-title"
            ];

            let position = "";

            for (const selector of titleSelectors) {
                const locator = card.locator(selector).first();

                if (await locator.count()) {
                    const text = await locator
                        .innerText()
                        .catch(() => "");

                    if (text) {
                        position = cleanText(text);
                        break;
                    }
                }
            }

            /*
             * Если заголовок не найден через
             * селекторы — берём текст ссылки.
             */
            if (!position) {
                position = cleanText(
                    await link.innerText().catch(() => "")
                );
            }

            if (!position) {
                console.log(`⚠️ Card ${i}: title not found`);
                continue;
            }

            let company = "Unknown";

            const companySelectors = [
                "h3",
                ".company",
                ".company-name"
            ];

            for (const selector of companySelectors) {
                const locator = card.locator(selector).first();

                if (await locator.count()) {
                    const text = await locator
                        .innerText()
                        .catch(() => "");

                    if (text && cleanText(text) !== position) {
                        company = cleanText(text);
                        break;
                    }
                }
            }

            const description = cleanText(
                await card.innerText().catch(() => "")
            );

            jobs.push({
                company,
                position,
                description,
                url: fullUrl,
                source: "We Work Remotely"
            });
        } catch (error) {
            console.log(`⚠️ Card ${i} parse failed`);
            console.log(error?.message || error);
        }
    }

    return jobs;
}

async function getWeWorkRemotelyJobs() {
    console.log("🌐 Opening We Work Remotely...");

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
        let allJobs = [];

        for (const term of SEARCH_TERMS) {
            try {
                const termJobs = await searchOneTerm(page, term);
                allJobs = allJobs.concat(termJobs);
            } catch (error) {
                console.log(`⚠️ We Work Remotely: search "${term}" failed`);
                console.log(error?.message || error);
            }
        }

        const uniqueJobs = [
            ...new Map(allJobs.map(job => [job.url, job])).values()
        ];

        console.log("");
        console.log(
            `🎯 We Work Remotely jobs collected: ${uniqueJobs.length}`
        );
        console.table(uniqueJobs);

        if (uniqueJobs.length === 0) {
            console.log(
                "⚠️ We Work Remotely: 0 jobs across all search terms"
            );

            try {
                await page.screenshot({
                    path: "wwr-debug.png",
                    fullPage: true
                });
                const html = await page.content();
                fs.writeFileSync("wwr-debug.html", html, "utf-8");
                console.log("📸 Debug screenshot + HTML saved");
            } catch (dumpError) {
                console.log("⚠️ Could not save debug artifacts");
            }
        }

        return uniqueJobs;
    } catch (error) {
        console.error("❌ We Work Remotely parser error:");
        console.error(error?.message || error);

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getWeWorkRemotelyJobs
};
