const { chromium } = require("playwright");

const WWR_URL =
    "https://weworkremotely.com/remote-jobs/search?term=QA";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
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
        await page.goto(WWR_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 We Work Remotely page loaded");

        await page.waitForTimeout(3000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        const jobs = [];

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
            `📋 Job cards found: ${count}`
        );

        if (count === 0) {
            console.log(
                "⚠️ We Work Remotely returned 0 jobs"
            );

            await page.screenshot({
                path: "wwr-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: wwr-debug.png"
            );

            return [];
        }

        for (let i = 0; i < count; i++) {
            try {
                const card =
                    jobItems.count()
                        ? jobItems.nth(i)
                        : page.locator("article").nth(i);

                const link =
                    card.locator("a").first();

                const href =
                    await link
                        .getAttribute("href")
                        .catch(() => null);

                if (!href) {
                    console.log(
                        `⚠️ Card ${i}: URL not found`
                    );
                    continue;
                }

                const fullUrl =
                    new URL(
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

                for (
                    const selector
                    of titleSelectors
                ) {
                    const locator =
                        card.locator(
                            selector
                        ).first();

                    if (
                        await locator.count()
                    ) {
                        const text =
                            await locator
                                .innerText()
                                .catch(() => "");

                        if (text) {
                            position =
                                cleanText(text);
                            break;
                        }
                    }
                }

                /*
                 * Если заголовок не найден через
                 * селекторы — берём текст ссылки.
                 */
                if (!position) {
                    position =
                        cleanText(
                            await link
                                .innerText()
                                .catch(() => "")
                        );
                }

                if (!position) {
                    console.log(
                        `⚠️ Card ${i}: title not found`
                    );
                    continue;
                }

                let company = "Unknown";

                const companySelectors = [
                    "h3",
                    ".company",
                    ".company-name"
                ];

                for (
                    const selector
                    of companySelectors
                ) {
                    const locator =
                        card.locator(
                            selector
                        ).first();

                    if (
                        await locator.count()
                    ) {
                        const text =
                            await locator
                                .innerText()
                                .catch(() => "");

                        if (
                            text &&
                            cleanText(text) !== position
                        ) {
                            company =
                                cleanText(text);
                            break;
                        }
                    }
                }

                const description =
                    cleanText(
                        await card
                            .innerText()
                            .catch(() => "")
                    );

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "We Work Remotely"
                });

            } catch (error) {
                console.log(
                    `⚠️ Card ${i} parse failed`
                );

                console.log(
                    error?.message || error
                );
            }
        }

        const uniqueJobs = [
            ...new Map(
                jobs.map(job => [
                    job.url,
                    job
                ])
            ).values()
        ];

        console.log("");

        console.log(
            `🎯 We Work Remotely jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error(
            "❌ We Work Remotely parser error:"
        );

        console.error(
            error?.message || error
        );

        return [];

    } finally {
        await browser.close();
    }
}

module.exports = {
    getWeWorkRemotelyJobs
};