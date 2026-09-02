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

    const searchUrls = [
        "https://geekjob.ru/",
        "https://geekjob.ru/vacancies"
    ];

    const jobs = [];

    try {
        for (const url of searchUrls) {
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

                continue;
            }

            const links = page.locator(
                'a[href*="/vacancy/"]'
            );

            const count = await links.count();

            console.log(
                `📋 Vacancy links found: ${count}`
            );

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

                if (!isQaJob(position)) {
                    continue;
                }

                const fullUrl = href.startsWith("http")
                    ? href
                    : `https://geekjob.ru${href}`;

                jobs.push({
                    company: "Unknown",
                    position,
                    description: "",
                    url: fullUrl,
                    source: "GeekJob"
                });
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