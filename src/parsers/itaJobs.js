const { chromium } = require("playwright");

async function getItaJobs() {
    console.log("🌐 Opening ITA Jobs Matches...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage({
        viewport: {
            width: 1440,
            height: 1000
        }
    });

    const url =
        "https://jobs.ita.am/matches/0812dfe0-f7f6-46b8-af84-178ca9fd843a";

    try {
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 ITA Matches page loaded");

        await page.waitForTimeout(5000);

        console.log(
            "📍 Current URL:",
            page.url()
        );

        console.log(
            "📄 Page title:",
            await page.title()
        );

        // Ищем все ссылки на странице
        const links = page.locator("a");

        const count = await links.count();

        console.log(
            `🔗 Links found: ${count}`
        );

        const jobs = [];

        for (let i = 0; i < count; i++) {

            const link = links.nth(i);

            const href =
                await link.getAttribute("href");

            const text =
                await link.innerText().catch(() => "");

            if (!href || !text) {
                continue;
            }

            const cleanText = text
                .replace(/\s+/g, " ")
                .trim();

            if (!cleanText) {
                continue;
            }

            // Игнорируем служебные ссылки
            if (
                cleanText === "Matches" ||
                cleanText === "Skip to content"
            ) {
                continue;
            }

            const fullUrl = new URL(
                href,
                "https://jobs.ita.am"
            ).href;

            jobs.push({
                company: "Unknown",
                position: cleanText,
                description: "",
                url: fullUrl,
                source: "ITA Jobs Matches"
            });
        }

        // Дедупликация
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
            `🎯 ITA Matches collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        // Если ничего не нашли — сохраняем screenshot
        if (uniqueJobs.length === 0) {

            await page.screenshot({
                path: "ita-matches-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Debug screenshot saved: ita-matches-debug.png"
            );
        }

        return uniqueJobs;

    } catch (error) {

        console.error(
            "❌ ITA Jobs parser error:"
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
    getItaJobs
};  