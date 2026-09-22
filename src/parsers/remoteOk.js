const { chromium } = require("playwright");

const REMOTE_OK_URL =
    "https://remoteok.com/remote-qa-jobs";

function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getRemoteOkJobs() {
    console.log("🌐 Opening Remote OK...");

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
        await page.goto(REMOTE_OK_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("🌐 Remote OK page loaded");

        await page.waitForTimeout(3000);

        console.log(`🔗 Current URL: ${page.url()}`);
        console.log(`📄 Page title: ${await page.title()}`);

        /*
         * Remote OK обычно размещает вакансии
         * в строках <tr> с классом job.
         */

        const rows = page.locator(
            "tr.job"
        );

        /*
         * Добавлено 2026-09-22: сайт показывает "327 results" для
         * Quality Assurance (подтверждено WebFetch), а мы каждый день
         * стабильно читали ровно 49-50 строк -- то есть только то,
         * что отрисовано сразу при загрузке. Остальное подгружается
         * при скролле (типичный паттерн Remote OK). Скроллим вниз,
         * пока число строк не перестанет расти -- тот же приём, что
         * уже используется для Telegram-каналов.
         */
        let previousCount = await rows.count();

        for (let scrollAttempt = 0; scrollAttempt < 20; scrollAttempt++) {
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });

            await page.waitForTimeout(1000);

            const newCount = await rows.count();

            if (newCount <= previousCount) {
                console.log(
                    `📋 Scroll stopped growing at ${newCount} rows (attempt ${scrollAttempt + 1})`
                );
                break;
            }

            previousCount = newCount;
        }

        const count = await rows.count();

        console.log(
            `📋 Job rows found: ${count}`
        );

        if (count === 0) {
            console.log(
                "⚠️ Remote OK returned 0 job rows"
            );

            await page.screenshot({
                path: "remoteok-debug.png",
                fullPage: true
            });

            console.log(
                "📸 Screenshot saved: remoteok-debug.png"
            );

            return [];
        }

        const jobs = [];

        for (let i = 0; i < count; i++) {

            try {

                const row =
                    rows.nth(i);

                /*
                 * Название вакансии.
                 */

                let position = "";

                const titleSelectors = [
                    "h2",
                    "h2[itemprop='title']",
                    '[itemprop="title"]',
                    ".company_and_position h2",
                    "a.preventLink h2"
                ];

                for (
                    const selector
                    of titleSelectors
                ) {

                    const locator =
                        row.locator(
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
                            text.trim()
                        ) {

                            position =
                                cleanText(text);

                            break;
                        }
                    }
                }

                /*
                 * Fallback: ищем любую ссылку
                 * на /remote-jobs/
                 */

                let href = null;

                const jobLinks =
                    row.locator(
                        'a[href*="/remote-jobs/"]'
                    );

                const linkCount =
                    await jobLinks.count();

                for (
                    let j = 0;
                    j < linkCount;
                    j++
                ) {

                    const link =
                        jobLinks.nth(j);

                    const candidateText =
                        await link
                            .innerText()
                            .catch(() => "");

                    const candidateHref =
                        await link
                            .getAttribute("href")
                            .catch(() => null);

                    if (
                        candidateText &&
                        candidateHref
                    ) {

                        if (!position) {
                            position =
                                cleanText(
                                    candidateText
                                );
                        }

                        href =
                            candidateHref;

                        break;
                    }
                }

                if (!position) {

                    console.log(
                        `⚠️ Row ${i}: title not found`
                    );

                    continue;
                }

                if (!href) {

                    const firstLink =
                        row.locator("a").first();

                    if (
                        await firstLink.count()
                    ) {

                        href =
                            await firstLink
                                .getAttribute(
                                    "href"
                                )
                                .catch(
                                    () => null
                                );
                    }
                }

                if (!href) {

                    console.log(
                        `⚠️ Row ${i}: URL not found`
                    );

                    continue;
                }

                /*
                 * Компания.
                 */

                let company =
                    "Unknown";

                const companySelectors = [
                    '[itemprop="hiringOrganization"]',
                    '[itemprop="name"]',
                    ".companyLink",
                    ".company"
                ];

                for (
                    const selector
                    of companySelectors
                ) {

                    const locator =
                        row.locator(
                            selector
                        ).first();

                    if (
                        await locator.count()
                    ) {

                        const text =
                            await locator
                                .innerText()
                                .catch(
                                    () => ""
                                );

                        if (
                            text &&
                            text.trim()
                        ) {

                            company =
                                cleanText(text);

                            break;
                        }
                    }
                }

                /*
                 * Description.
                 */

                let description = "";

                const descriptionSelectors = [
                    ".description",
                    '[itemprop="description"]',
                    ".job_description"
                ];

                for (
                    const selector
                    of descriptionSelectors
                ) {

                    const locator =
                        row.locator(
                            selector
                        ).first();

                    if (
                        await locator.count()
                    ) {

                        const text =
                            await locator
                                .innerText()
                                .catch(
                                    () => ""
                                );

                        if (
                            text &&
                            text.trim()
                        ) {

                            description =
                                cleanText(text);

                            break;
                        }
                    }
                }

                const fullUrl =
                    new URL(
                        href,
                        "https://remoteok.com"
                    ).href;

                jobs.push({
                    company,
                    position,
                    description,
                    url: fullUrl,
                    source: "Remote OK"
                });

            } catch (error) {

                console.log(
                    `⚠️ Remote OK row ${i} parse failed`
                );

                console.log(
                    error?.message || error
                );
            }
        }

        /*
         * Дедупликация.
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
            `🎯 Remote OK jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {

        console.error(
            "❌ Remote OK parser error:"
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
    getRemoteOkJobs
};
