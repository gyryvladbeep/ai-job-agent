const { chromium } = require("playwright");

const TALANTO_URL =
    "https://talanto.work/?sort=newest&period=day&offset=0&search_in=title&q=Qa+engineer";

/*
 * Добавлено 2026-09-22: подтверждено WebFetch, что у дневной выдачи
 * тоже есть вторая страница (пагинация "1"/"2" внизу) -- парсер
 * читал только то, что отрисовано на первой загрузке. Точный URL-
 * параметр пагинации неизвестен (сайт может использовать offset,
 * page или что-то ещё), поэтому вместо угадывания URL кликаем по
 * реальной кнопке "следующая страница" в DOM -- это надёжнее и не
 * сломается, если параметр окажется не тем, что мы предположили.
 */
const MAX_PAGES = 5;

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

async function goToNextPage(page) {
    /*
     * Пробуем несколько правдоподобных вариантов кнопки/ссылки
     * "следующая страница" -- вёрстка пагинации заранее неизвестна,
     * а угадывать один жёсткий селектор рискованно (как раз то, из-за
     * чего этот источник и застревал на одной странице).
     */
    const nextSelectors = [
        'a[aria-label="Next page"]',
        'a[aria-label="Next"]',
        'button[aria-label="Next page"]',
        'a[rel="next"]',
        'nav[aria-label*="agination"] a:has-text("2")',
        'a:has-text("»")'
    ];

    for (const selector of nextSelectors) {
        const candidate = page.locator(selector).first();

        if (await candidate.count()) {
            const isDisabled = await candidate
                .getAttribute("aria-disabled")
                .catch(() => null);

            if (isDisabled === "true") {
                continue;
            }

            try {
                await candidate.click({ timeout: 5000 });
                return true;
            } catch (error) {
                continue;
            }
        }
    }

    return false;
}

async function getTalantoJobs() {
    console.log("🌐 Opening Talanto...");

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();

    const jobs = [];
    const seenUrls = new Set();

    let premiumSkipped = 0;
    let invalidSkipped = 0;

    try {
        await page.goto(TALANTO_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Talanto page loaded");

        await page.waitForTimeout(3000);

        for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
            try {
                await page.locator("article").first().waitFor({
                    state: "visible",
                    timeout: 10000
                });
            } catch {
                console.log(
                    `⚠️ Page ${pageNum}: job cards did not appear within 10 seconds`
                );
            }

            const cards = page.locator("article");
            const count = await cards.count();

            console.log(`✅ Page ${pageNum}: found ${count} job cards`);

            if (count === 0) {
                if (pageNum === 1) {
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
                }

                break;
            }

            let newOnThisPage = 0;

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

                const fullUrl = new URL(
                    link,
                    "https://talanto.work"
                ).href;

                if (seenUrls.has(fullUrl)) {
                    continue;
                }

                seenUrls.add(fullUrl);
                newOnThisPage++;

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

                jobs.push({
                    company,
                    position,
                    description: cardText || "",
                    url: fullUrl,
                    source: "Talanto"
                });
            }

            if (newOnThisPage === 0) {
                console.log(
                    `📋 No new cards on page ${pageNum}, stopping`
                );
                break;
            }

            const moved = await goToNextPage(page);

            if (!moved) {
                console.log(
                    `📋 No next-page control found after page ${pageNum}, stopping`
                );
                break;
            }

            await page.waitForTimeout(2000);
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
