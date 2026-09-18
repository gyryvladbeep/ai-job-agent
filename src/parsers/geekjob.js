const fs = require("fs");
const { chromium } = require("playwright");

const QA_KEYWORDS = [
    "qa",
    "quality assurance",
    "tester",
    "testing",
    "тестировщик",
    "тестирование",
    "тестировщик по",
    "инженер по тестированию",
    "qa engineer",
    "qa automation",
    "automation qa",
    "automation tester",
    "test engineer",
    "test automation",
    "sdet",
    "manual qa",
    "manual tester"
];

const EXCLUDED_KEYWORDS = [
    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",
    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",

    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",
    "разработчик",
    "программист",

    "devops",
    "devsecops",
    "sre",

    "data scientist",
    "machine learning",
    "ml engineer",

    "project manager",
    "product manager",
    "менеджер проекта",
    "продакт-менеджер",

    "designer",
    "recruiter",
    "рекрутер",
    "technical support",
    "техническая поддержка"
];

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}

function isQaJob(position) {
    const title = normalize(position);

    const hasQaKeyword = QA_KEYWORDS.some(keyword =>
        title.includes(normalize(keyword))
    );

    if (!hasQaKeyword) {
        return false;
    }

    const hasExcludedKeyword = EXCLUDED_KEYWORDS.some(keyword =>
        title.includes(normalize(keyword))
    );

    if (hasExcludedKeyword) {
        return false;
    }

    return true;
}

async function getGeekJobJobs() {
    console.log("🌐 Opening GeekJob...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    /*
     * GeekJob не даёт очевидного URL для поиска именно QA-вакансий
     * (несколько вариантов вроде ?qs=QA и /vacancies/qa не сработали
     * при проверке) -- поэтому продолжаем брать общий поток вакансий
     * и полагаемся на QA-фильтр. Но раньше читали только первую
     * страницу /vacancies -- теперь листаем дальше, пока не
     * закончатся новые ссылки.
     */
    const MAX_PAGES = 6;

    const jobs = [];
    const seenUrls = new Set();

    try {
        console.log("🔎 Parsing: https://geekjob.ru/");

        try {
            await page.goto("https://geekjob.ru/", {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForTimeout(2000);
        } catch (error) {
            console.log(
                `⚠️ Failed to open homepage: ${error.message}`
            );
        }

        for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
            const url =
                "https://geekjob.ru/vacancies" +
                (pageNum > 1 ? `?page=${pageNum}` : "");

            console.log(`🔎 Parsing: ${url}`);

            try {
                await page.goto(url, {
                    waitUntil: "domcontentloaded",
                    timeout: 30000
                });

                await page.waitForTimeout(2000);
            } catch (error) {
                console.log(
                    `⚠️ Failed to open ${url}: ${error.message}`
                );

                break;
            }

            const links = page.locator(
                'a[href*="/vacancy/"]'
            );

            const count = await links.count();

            console.log(
                `📋 Page ${pageNum}: ${count} vacancy links found`
            );

            if (count === 0) {
                console.log(
                    `⚠️ GeekJob: 0 links on page ${pageNum} -- dumping for inspection`
                );

                try {
                    await page.screenshot({
                        path: `geekjob-page${pageNum}-debug.png`,
                        fullPage: true
                    });

                    const html = await page.content();
                    fs.writeFileSync(
                        `geekjob-page${pageNum}-debug.html`,
                        html,
                        "utf-8"
                    );

                    console.log(
                        "📸 Debug screenshot + HTML saved"
                    );
                } catch (dumpError) {
                    console.log("⚠️ Could not save debug artifacts");
                    console.log(dumpError?.message || dumpError);
                }
            }

            let newOnThisPage = 0;

            for (let i = 0; i < count; i++) {
                const link = links.nth(i);

                const href = await link.getAttribute("href");
                const text = await link.innerText();

                if (!href || !text) {
                    continue;
                }

                const position = text
                    .replace(/\s+/g, " ")
                    .trim();

                const fullUrl = href.startsWith("http")
                    ? href
                    : `https://geekjob.ru${href}`;

                if (seenUrls.has(fullUrl)) {
                    continue;
                }

                seenUrls.add(fullUrl);
                newOnThisPage++;

                if (!isQaJob(position)) {
                    continue;
                }

                jobs.push({
                    company: "Unknown",
                    position,
                    description: "",
                    url: fullUrl,
                    source: "GeekJob"
                });
            }

            if (newOnThisPage === 0) {
                console.log(
                    `📋 No new links on page ${pageNum}, stopping`
                );
                break;
            }
        }

        const uniqueJobs = [
            ...new Map(
                jobs.map(job => [job.url, job])
            ).values()
        ];

        console.log(
            `🎯 GeekJob QA jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error("❌ GeekJob parser error:");
        console.error(error.message);

        return [];

    } finally {
        await browser.close();
    }
}

module.exports = {
    getGeekJobJobs,
    isQaJob
};