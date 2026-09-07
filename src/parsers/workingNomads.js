const fs = require("fs");
const { chromium } = require("playwright");

// Working Nomads groups remote jobs by category via path segments,
// not query params -- QA has its own dedicated listing page.
const WORKING_NOMADS_URL =
    "https://www.workingnomads.com/remote-qa-jobs";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getWorkingNomadsJobs() {
    console.log("🌐 Opening Working Nomads...");

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
        await page.goto(WORKING_NOMADS_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Working Nomads page loaded");

        // Listings render client-side after the initial HTML, give
        // the page time to hydrate before we start querying rows.
        await page.waitForTimeout(3000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        /*
         * Не знаем точную структуру заранее (сайт может поменять
         * вёрстку), поэтому пробуем несколько вариантов селекторов
         * для строк списка вакансий -- как и в остальных парсерах.
         */
        /*
         * Подтверждено вручную (см. workingnomads-debug.html): каждая
         * карточка -- это сам <a id="job-N" class="job-desktop ...">,
         * а не обёртка с вложенной ссылкой. Держим старые варианты
         * вторым/третьим приоритетом на случай, если вёрстку поменяют.
         */
        const rowSelectors = [
            "a.job-desktop",
            "li.job",
            ".jobs-list li",
            "[class*='job-list'] li",
            "[class*='JobListing']"
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
                    `📋 Job rows found via "${selector}": ${count}`
                );

                break;
            }
        }

        if (!rows || count === 0) {
            console.log(
                "⚠️ Working Nomads: no job rows found with any known selector"
            );

            await page.screenshot({
                path: "workingnomads-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: workingnomads-debug.png"
            );

            try {
                const html = await page.content();
                fs.writeFileSync("workingnomads-debug.html", html, "utf-8");
                console.log("📄 HTML saved: workingnomads-debug.html");
            } catch (dumpError) {
                console.log("⚠️ Could not save debug HTML");
                console.log(dumpError?.message || dumpError);
            }

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {
            try {
                const row = rows.nth(i);

                let position = "";

                const titleSelectors = [
                    "h2",
                    "h3",
                    ".title",
                    "[class*='title']",
                    "a"
                ];

                for (const selector of titleSelectors) {
                    const locator = row.locator(selector).first();

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
                    console.log(`⚠️ Row ${i}: title not found`);
                    continue;
                }

                /*
                 * На job-desktop карточках сама карточка -- это <a>,
                 * так что href нужно брать с неё, а не искать вложенную
                 * ссылку (которой может не быть или которая ведёт на
                 * тег/категорию, а не на вакансию).
                 */
                let href = await row
                    .getAttribute("href")
                    .catch(() => null);

                if (!href) {
                    const link = row.locator("a").first();

                    if (await link.count()) {
                        href = await link
                            .getAttribute("href")
                            .catch(() => null);
                    }
                }

                if (!href) {
                    console.log(`⚠️ Row ${i}: URL not found`);
                    continue;
                }

                let company = "Unknown";

                const companySelectors = [
                    ".company",
                    "[class*='company']",
                    "[class*='Company']"
                ];

                for (const selector of companySelectors) {
                    const locator = row.locator(selector).first();

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
                    await row.innerText().catch(() => "")
                );

                const fullUrl = new URL(
                    href,
                    "https://www.workingnomads.com"
                ).href;

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "Working Nomads"
                });
            } catch (error) {
                console.log(`⚠️ Working Nomads row ${i} parse failed`);
                console.log(error?.message || error);
            }
        }

        const uniqueJobs = [
            ...new Map(jobs.map((job) => [job.url, job])).values()
        ];

        console.log("");
        console.log(
            `🎯 Working Nomads jobs collected: ${uniqueJobs.length}`
        );
        console.table(uniqueJobs);

        /*
         * Раньше debug-дамп сохранялся только если сам селектор строк
         * не нашёл ничего (count === 0). Но однажды count был > 0 (сайт
         * такой же), а итоговый uniqueJobs всё равно оказался пустым --
         * то есть каждая строка по отдельности не прошла извлечение
         * href/title (например, разметка внутри карточки поменялась,
         * хотя обёртка a.job-desktop осталась той же). Тот случай был
         * невидим: ни один из существующих debug-путей не сработал.
         * Ловим и его тоже.
         */
        if (uniqueJobs.length === 0 && count > 0) {
            console.log(
                "⚠️ Working Nomads: rows were found by selector but none produced a valid job -- dumping for inspection"
            );

            try {
                await page.screenshot({
                    path: "workingnomads-empty-extract.png",
                    fullPage: true
                });
                const html = await page.content();
                fs.writeFileSync(
                    "workingnomads-empty-extract.html",
                    html,
                    "utf-8"
                );
                console.log("📸 Debug screenshot + HTML saved");
            } catch (dumpError) {
                console.log("⚠️ Could not save debug artifacts");
            }
        }

        return uniqueJobs;
    } catch (error) {
        console.error("❌ Working Nomads parser error:");
        console.error(error?.message || error);

        try {
            await page.screenshot({
                path: "workingnomads-error.png",
                fullPage: true
            });
            const html = await page.content();
            fs.writeFileSync("workingnomads-error.html", html, "utf-8");
            console.log("📸 Error screenshot + HTML saved");
        } catch (dumpError) {
            console.log("⚠️ Could not save error debug artifacts");
        }

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getWorkingNomadsJobs
};
