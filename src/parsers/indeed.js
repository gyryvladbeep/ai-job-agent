const { chromium } = require("playwright");

const INDEED_URL =
    "https://www.indeed.com/jobs?q=QA+Engineer&sort=date";

async function getIndeedJobs() {
    console.log("🌐 Opening Indeed...");

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
        await page.goto(INDEED_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Indeed page loaded");

        await page.waitForTimeout(3000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        const cards = page.locator(
            "div.job_seen_beacon"
        );

        const count = await cards.count();

        console.log(
            `📋 Job cards found: ${count}`
        );

        if (count === 0) {
            console.log(
                "⚠️ Indeed returned 0 job cards"
            );

            await page.screenshot({
                path: "indeed-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: indeed-debug.png"
            );

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const card = cards.nth(i);

                // ==========================================
                // TITLE
                // ==========================================

                let position = "";

                const titleSelectors = [
                    '[data-testid="job-title"]',
                    'h2',
                    'h2 a',
                    'a[href*="/viewjob"]',
                    'a[href*="/rc/clk"]'
                ];

                for (const selector of titleSelectors) {
                    const locator = card
                        .locator(selector)
                        .first();

                    if (await locator.count()) {
                        const text =
                            await locator.innerText()
                                .catch(() => "");

                        if (text && text.trim()) {
                            position = text
                                .replace(/\s+/g, " ")
                                .trim();

                            break;
                        }
                    }
                }

                // ==========================================
                // FALLBACK: анализируем ссылки
                // ==========================================

                if (!position) {
                    const links = card.locator("a");

                    const linkCount =
                        await links.count();

                    for (
                        let j = 0;
                        j < linkCount;
                        j++
                    ) {
                        const link =
                            links.nth(j);

                        const text =
                            await link
                                .innerText()
                                .catch(() => "");

                        const href =
                            await link
                                .getAttribute("href")
                                .catch(() => null);

                        if (
                            text &&
                            href &&
                            (
                                href.includes("/viewjob") ||
                                href.includes("/rc/clk")
                            )
                        ) {
                            position = text
                                .replace(/\s+/g, " ")
                                .trim();

                            break;
                        }
                    }
                }

                if (!position) {
                    console.log(
                        `⚠️ Card ${i}: title not found`
                    );

                    // Диагностика только для первой карточки
                    if (i === 0) {
                        console.log(
                            "🔍 First card HTML preview:"
                        );

                        const html =
                            await card.innerHTML();

                        console.log(
                            html.substring(0, 3000)
                        );
                    }

                    continue;
                }

                // ==========================================
                // COMPANY
                // ==========================================

                let company = "Unknown";

                const companySelectors = [
                    '[data-testid="company-name"]',
                    '[data-testid="companyName"]',
                    '.companyName',
                    '[class*="company"]'
                ];

                for (
                    const selector
                    of companySelectors
                ) {
                    const locator = card
                        .locator(selector)
                        .first();

                    if (
                        await locator.count()
                    ) {
                        const text =
                            await locator
                                .innerText()
                                .catch(() => "");

                        if (
                            text &&
                            text.trim()
                        ) {
                            company = text
                                .replace(
                                    /\s+/g,
                                    " "
                                )
                                .trim();

                            break;
                        }
                    }
                }

                // ==========================================
                // LOCATION
                // ==========================================

                let location = "";

                const locationSelectors = [
                    '[data-testid="text-location"]',
                    '[data-testid="job-location"]',
                    '.companyLocation',
                    '[class*="location"]'
                ];

                for (
                    const selector
                    of locationSelectors
                ) {
                    const locator = card
                        .locator(selector)
                        .first();

                    if (
                        await locator.count()
                    ) {
                        const text =
                            await locator
                                .innerText()
                                .catch(() => "");

                        if (
                            text &&
                            text.trim()
                        ) {
                            location =
                                text
                                    .replace(
                                        /\s+/g,
                                        " "
                                    )
                                    .trim();

                            break;
                        }
                    }
                }

                // ==========================================
                // DESCRIPTION
                // ==========================================

                let description = "";

                const descriptionSelectors = [
                    '[data-testid="job-snippet"]',
                    '.job-snippet',
                    '[class*="job-snippet"]'
                ];

                for (
                    const selector
                    of descriptionSelectors
                ) {
                    const locator = card
                        .locator(selector)
                        .first();

                    if (
                        await locator.count()
                    ) {
                        const text =
                            await locator
                                .innerText()
                                .catch(() => "");

                        if (
                            text &&
                            text.trim()
                        ) {
                            description =
                                text
                                    .replace(
                                        /\s+/g,
                                        " "
                                    )
                                    .trim();

                            break;
                        }
                    }
                }

                // ==========================================
                // URL
                // ==========================================

                let href = null;

                const jobLinks = card.locator(
                    'a[href*="/viewjob"], a[href*="/rc/clk"]'
                );

                const jobLinkCount =
                    await jobLinks.count();

                for (
                    let j = 0;
                    j < jobLinkCount;
                    j++
                ) {
                    const link =
                        jobLinks.nth(j);

                    const candidate =
                        await link
                            .getAttribute("href")
                            .catch(() => null);

                    if (candidate) {
                        href = candidate;
                        break;
                    }
                }

                // fallback
                if (!href) {
                    const firstLink =
                        card.locator("a").first();

                    if (
                        await firstLink.count()
                    ) {
                        href =
                            await firstLink
                                .getAttribute("href")
                                .catch(() => null);
                    }
                }

                if (!href) {
                    console.log(
                        `⚠️ Card ${i}: URL not found`
                    );

                    continue;
                }

                const fullUrl =
                    new URL(
                        href,
                        "https://www.indeed.com"
                    ).href;

                // ==========================================
                // FINAL DESCRIPTION
                // ==========================================

                const fullDescription = [
                    description,
                    location
                ]
                    .filter(Boolean)
                    .join(" | ");

                jobs.push({
                    company:
                        company || "Unknown",

                    position,

                    description:
                        fullDescription,

                    url:
                        fullUrl,

                    source:
                        "Indeed"
                });

            } catch (error) {
                console.log(
                    `⚠️ Indeed card ${i} parse failed`
                );

                console.log(
                    error?.message || error
                );
            }
        }

        // ==========================================
        // DEDUPLICATION
        // ==========================================

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
            `🎯 Indeed QA jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error(
            "❌ Indeed parser error:"
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
    getIndeedJobs
};