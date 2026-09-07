const { chromium } = require("playwright");
const fs = require("fs");

/*
 * Himalayas' robots.txt explicitly disallows crawling paginated URLs
 * for /jobs (Disallow: /jobs?page=, /jobs*&page=, /jobs/*?page=) --
 * confirmed by reading it directly before writing this parser. So this
 * only ever reads page 1 of the quality-assurance category, on
 * purpose, not because pagination wasn't implemented.
 */
const HIMALAYAS_URL = "https://himalayas.app/jobs/quality-assurance";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getHimalayasJobs() {
    console.log("🌐 Opening Himalayas...");

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
        await page.goto(HIMALAYAS_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Himalayas page loaded");

        await page.waitForTimeout(2500);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        /*
         * Точная вёрстка неизвестна заранее (проверялась только через
         * текстовый рендер, не живой DOM) -- как и в остальных
         * парсерах, пробуем несколько вариантов селекторов карточек.
         */
        const rowSelectors = [
            "a[href*='/companies/'][href*='/jobs/']",
            "[class*='JobCard']",
            "[class*='job-card']",
            "article a[href*='/jobs/']",
            "li a[href*='/jobs/']"
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
                "⚠️ Himalayas: no job cards found with any known selector"
            );

            await page.screenshot({
                path: "himalayas-debug.png",
                fullPage: true
            });
            const html = await page.content();
            fs.writeFileSync("himalayas-debug.html", html, "utf-8");

            console.log("📸 Debug screenshot + HTML saved");

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const card = rows.nth(i);

                const href = await card
                    .getAttribute("href")
                    .catch(() => null);

                if (!href) {
                    console.log(`⚠️ Card ${i}: URL not found`);
                    continue;
                }

                let position = "";

                const titleSelectors = ["h2", "h3", "[class*='title']"];

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
                    // Резюме карточки нет по селектору -- берём весь
                    // текст ссылки как запасной вариант.
                    position = cleanText(
                        await card.innerText().catch(() => "")
                    ).slice(0, 120);
                }

                if (!position) {
                    console.log(`⚠️ Card ${i}: title not found`);
                    continue;
                }

                let company = "Unknown";

                const companySelectors = [
                    "[class*='company']",
                    "[class*='Company']"
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

                const fullUrl = new URL(href, "https://himalayas.app").href;

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "Himalayas"
                });
            } catch (error) {
                console.log(`⚠️ Himalayas card ${i} parse failed`);
                console.log(error?.message || error);
            }
        }

        const uniqueJobs = [
            ...new Map(jobs.map((job) => [job.url, job])).values()
        ];

        console.log("");
        console.log(`🎯 Himalayas jobs collected: ${uniqueJobs.length}`);
        console.table(uniqueJobs);

        if (uniqueJobs.length === 0 && count > 0) {
            console.log(
                "⚠️ Himalayas: rows found but none produced a valid job -- dumping for inspection"
            );

            try {
                await page.screenshot({
                    path: "himalayas-empty-extract.png",
                    fullPage: true
                });
                const html = await page.content();
                fs.writeFileSync(
                    "himalayas-empty-extract.html",
                    html,
                    "utf-8"
                );
            } catch (dumpError) {
                console.log("⚠️ Could not save debug artifacts");
            }
        }

        return uniqueJobs;
    } catch (error) {
        console.error("❌ Himalayas parser error:");
        console.error(error?.message || error);

        try {
            await page.screenshot({
                path: "himalayas-error.png",
                fullPage: true
            });
            const html = await page.content();
            fs.writeFileSync("himalayas-error.html", html, "utf-8");
        } catch (dumpError) {
            console.log("⚠️ Could not save error debug artifacts");
        }

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getHimalayasJobs
};
