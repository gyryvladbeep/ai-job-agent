const { chromium } = require("playwright");

/*
 * Подтверждено вручную (живая проверка в браузере 2026-09-09 и
 * WebFetch 2026-09-18): ?query=QA%20Engineer на /jobs не фильтрует
 * вообще ничего -- сайт отдаёт "0 results" и молча показывает
 * общую подборку трендовых вакансий (Sales, Product, Design...),
 * из-за чего парсер честно собирал 45-51 вакансию в день, но НИ
 * ОДНА не была реальной QA-позицией (все отсеивались общим QA-
 * фильтром) -- 9 дней подряд, 0 новых. /role/r/qa-engineer -- это
 * настоящая категорийная страница с реальными QA-вакансиями.
 *
 * Добавлено 2026-09-22: страница честно показывает только первую
 * порцию карточек (стабильно ~24 каждый день подряд), а WebFetch
 * подтвердил "229 results total" / "Page 1 of 9" с пагинацией через
 * ?page=N -- то есть мы читали примерно 1/9 реального списка. Теперь
 * листаем страницы, как в Habr Career/GeekJob.
 */
const WELLFOUND_BASE_URL =
    "https://wellfound.com/role/r/qa-engineer";

const MAX_PAGES = 9;

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

    const jobs = [];
    const seenUrls = new Set();

    try {
        for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
            const url =
                pageNum === 1
                    ? WELLFOUND_BASE_URL
                    : `${WELLFOUND_BASE_URL}?page=${pageNum}`;

            console.log(`🔎 Parsing: ${url}`);

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForTimeout(4000);

            if (pageNum === 1) {
                console.log(`🔗 Current URL: ${page.url()}`);
                console.log(`📄 Page title: ${await page.title()}`);
            }

            /*
             * Wellfound периодически меняет DOM,
             * поэтому сначала ищем ссылки на вакансии.
             */

            const vacancyLinks = page.locator(
                'a[href*="/jobs/"]'
            );

            const count = await vacancyLinks.count();

            console.log(
                `📋 Page ${pageNum}: ${count} vacancy links found`
            );

            if (count === 0) {
                if (pageNum === 1) {
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
                }

                break;
            }

            let newOnThisPage = 0;

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

                    if (seenUrls.has(fullUrl)) {
                        continue;
                    }

                    seenUrls.add(fullUrl);
                    newOnThisPage++;

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

            if (newOnThisPage === 0) {
                console.log(
                    `📋 No new links on page ${pageNum}, stopping`
                );
                break;
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
