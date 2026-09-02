const { chromium } = require("playwright");

const WELLFOUND_URL =
    "https://wellfound.com/jobs?query=QA%20Engineer";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getWellfoundJobs() {
    console.log("🌐 Opening Wellfound...");

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
        await page.goto(WELLFOUND_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Wellfound page loaded");

        await page.waitForTimeout(4000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        /*
         * Wellfound периодически меняет DOM,
         * поэтому сначала ищем ссылки на вакансии.
         */

        const vacancyLinks = page.locator(
            'a[href*="/jobs/"]'
        );

        const count = await vacancyLinks.count();

        console.log(
            `📋 Vacancy links found: ${count}`
        );

        if (count === 0) {
            console.log(
                "⚠️ Wellfound returned 0 vacancy links"
            );

            await page.screenshot({
                path: "wellfound-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: wellfound-debug.png"
            );

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const link =
                    vacancyLinks.nth(i);

                const href =
                    await link.getAttribute("href");

                const text =
                    await link.innerText()
                        .catch(() => "");

                if (!href) {
                    continue;
                }

                const position =
                    cleanText(text);

                if (!position) {
                    continue;
                }

                /*
                 * Игнорируем ссылки без нормального
                 * названия вакансии.
                 */

                if (position.length < 3) {
                    continue;
                }

                const fullUrl =
                    new URL(
                        href,
                        "https://wellfound.com"
                    ).href;

                /*
                 * Пытаемся найти карточку вакансии
                 * и компанию.
                 */

                let company = "Unknown";

                const card =
                    link.locator(
                        "xpath=ancestor::*[self::div or self::li][1]"
                    );

                if (await card.count()) {
                    const cardText =
                        await card.innerText()
                            .catch(() => "");

                    const lines =
                        cardText
                            .split("\n")
                            .map(cleanText)
                            .filter(Boolean);

                    /*
                     * Обычно название компании находится
                     * рядом с названием вакансии.
                     */

                    for (const line of lines) {
                        if (
                            line !== position &&
                            line.length > 1 &&
                            line.length < 100
                        ) {
                            company = line;
                            break;
                        }
                    }
                }

                jobs.push({
                    company,
                    position,
                    description: "",
                    url: fullUrl,
                    source: "Wellfound"
                });

            } catch (error) {
                console.log(
                    `⚠️ Wellfound card ${i} parse failed`
                );

                console.log(
                    error?.message || error
                );
            }
        }

        /*
         * Убираем дубликаты.
         */

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
            `🎯 Wellfound jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error(
            "❌ Wellfound parser error:"
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
    getWellfoundJobs
};