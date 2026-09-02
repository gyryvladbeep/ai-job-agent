const { chromium } = require("playwright");

const TALANTO_URL =
    "https://talanto.work/?sort=newest&period=day&offset=0&search_in=title&q=Qa+engineer";

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

    /*
     * После обновления Talanto вакансии, доступные только по платной
     * подписке, помечаются звёздочкой (*) прямо в названии/карточке
     * вместо старого текстового лейбла. Ловим и это.
     */
    if (String(text || "").includes("*")) {
        return true;
    }

    return false;
}

function parseCompanyAndPosition(label) {
    const separatorIndex = label.indexOf(": ");

    if (separatorIndex === -1) {
        return {
            company: "Unknown",
            position: label.trim()
        };
    }

    return {
        company: label
            .substring(0, separatorIndex)
            .trim(),

        position: label
            .substring(separatorIndex + 2)
            .trim()
    };
}

async function getTalantoJobs() {
    console.log("🌐 Opening Talanto...");

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();

    try {
        await page.goto(TALANTO_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Talanto page loaded");

        await page.waitForTimeout(3000);

        try {
            await page.locator("article").first().waitFor({
                state: "visible",
                timeout: 10000
            });
        } catch {
            console.log(
                "⚠️ Job cards did not appear within 10 seconds"
            );
        }

        const cards = page.locator("article");
        const count = await cards.count();

        console.log(`✅ Found ${count} job cards`);

        if (count === 0) {
            console.log("⚠️ No job cards found");
            console.log("Current URL:", page.url());
            console.log("Page title:", await page.title());

            await page.screenshot({
                path: "talanto-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: talanto-debug.png"
            );

            return [];
        }

        const jobs = [];

        let premiumSkipped = 0;
        let invalidSkipped = 0;

        for (let i = 0; i < count; i++) {
            const card = cards.nth(i);

            const cardText = await card.innerText();

            /*
             * Premium / Boost вакансии.
             *
             * Если Talanto показывает карточку,
             * но сама вакансия доступна только по подписке,
             * пропускаем её.
             */
            if (isPremiumCard(cardText)) {
                premiumSkipped++;

                console.log(
                    `🔒 Skipping premium vacancy #${i}`
                );

                continue;
            }

            const jobLink = card
                .locator("a[aria-label]")
                .first();

            const link = await jobLink.getAttribute("href");
            const label = await jobLink.getAttribute(
                "aria-label"
            );

            if (!link || !label) {
                invalidSkipped++;

                console.log(
                    `⚠️ Skipping card ${i}: missing link or label`
                );

                continue;
            }

            const {
                company,
                position
            } = parseCompanyAndPosition(label);

            /*
             * Дополнительная защита.
             *
             * Иногда на странице могут находиться
             * служебные ссылки, которые случайно попали
             * внутрь article.
             */
            if (!position) {
                invalidSkipped++;
                continue;
            }

            const fullUrl = new URL(
                link,
                "https://talanto.work"
            ).href;

            jobs.push({
                company,
                position,
                description: cardText || "",
                url: fullUrl,
                source: "Talanto"
            });
        }

        /*
         * Дополнительная дедупликация.
         */
        const uniqueJobs = [
            ...new Map(
                jobs.map(job => [job.url, job])
            ).values()
        ];

        console.log("");
        console.log(
            `🎯 Talanto jobs collected: ${uniqueJobs.length}`
        );

        console.log(
            `🔒 Premium skipped: ${premiumSkipped}`
        );

        console.log(
            `⚠️ Invalid cards skipped: ${invalidSkipped}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error(
            "❌ Talanto parser error:"
        );

        console.error(error);

        return [];

    } finally {
        await browser.close();
    }
}

module.exports = {
    getTalantoJobs
};