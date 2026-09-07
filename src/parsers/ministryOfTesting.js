const { chromium } = require("playwright");
const fs = require("fs");

// Ministry of Testing is a QA/testing-specific community and job board
// -- every listing here is already testing-relevant by construction,
// unlike the general boards where most of what's on the page has
// nothing to do with QA. robots.txt checked directly: /jobs isn't
// disallowed for general crawlers, only /admin and a handful of
// known scraper bots by name.
const MOT_URL = "https://www.ministryoftesting.com/jobs";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getMinistryOfTestingJobs() {
    console.log("🌐 Opening Ministry of Testing...");

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
        await page.goto(MOT_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Ministry of Testing page loaded");

        await page.waitForTimeout(2500);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        const rowSelectors = [
            "a[href*='/jobs/']:not([href$='/jobs/'])",
            "[class*='JobCard']",
            "[class*='job-card']",
            "article",
            "li[class*='job']"
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
                "⚠️ Ministry of Testing: no job cards found with any known selector"
            );

            await page.screenshot({
                path: "ministryoftesting-debug.png",
                fullPage: true
            });
            const html = await page.content();
            fs.writeFileSync("ministryoftesting-debug.html", html, "utf-8");

            console.log("📸 Debug screenshot + HTML saved");

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const card = rows.nth(i);

                let href = await card.getAttribute("href").catch(() => null);

                if (!href) {
                    const link = card.locator("a").first();

                    if (await link.count()) {
                        href = await link
                            .getAttribute("href")
                            .catch(() => null);
                    }
                }

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
                    "https://www.ministryoftesting.com"
                ).href;

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "Ministry of Testing"
                });
            } catch (error) {
                console.log(`⚠️ Ministry of Testing card ${i} parse failed`);
                console.log(error?.message || error);
            }
        }

        const uniqueJobs = [
            ...new Map(jobs.map((job) => [job.url, job])).values()
        ];

        console.log("");
        console.log(
            `🎯 Ministry of Testing jobs collected: ${uniqueJobs.length}`
        );
        console.table(uniqueJobs);

        if (uniqueJobs.length === 0 && count > 0) {
            console.log(
                "⚠️ Ministry of Testing: rows found but none produced a valid job -- dumping for inspection"
            );

            try {
                await page.screenshot({
                    path: "ministryoftesting-empty-extract.png",
                    fullPage: true
                });
                const html = await page.content();
                fs.writeFileSync(
                    "ministryoftesting-empty-extract.html",
                    html,
                    "utf-8"
                );
            } catch (dumpError) {
                console.log("⚠️ Could not save debug artifacts");
            }
        }

        return uniqueJobs;
    } catch (error) {
        console.error("❌ Ministry of Testing parser error:");
        console.error(error?.message || error);

        try {
            await page.screenshot({
                path: "ministryoftesting-error.png",
                fullPage: true
            });
            const html = await page.content();
            fs.writeFileSync("ministryoftesting-error.html", html, "utf-8");
        } catch (dumpError) {
            console.log("⚠️ Could not save error debug artifacts");
        }

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getMinistryOfTestingJobs
};
