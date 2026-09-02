const { chromium } = require("playwright");

const QA_KEYWORDS = [
    // English
    "qa engineer",
    "qa automation",
    "automation qa",
    "automation tester",
    "automation test engineer",
    "test engineer",
    "test automation engineer",
    "software tester",
    "qa tester",
    "quality assurance engineer",
    "sdet",
    "manual qa",
    "manual tester",
    "qa analyst",
    "qa engineer",
    "quality assurance",

    // Russian
    "тестировщик",
    "тестировщик по",
    "инженер по тестированию",
    "специалист по тестированию",
    "автоматизатор тестирования",
    "инженер qa",
    "инженер по качеству",
    "инженер по качеству по",
    "тест-инженер",
    "тест инженер",
    "инженер-тестировщик"
];

const EXCLUDED_KEYWORDS = [
    // Analysts
    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",
    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",
    "продуктовый аналитик",

    // Developers
    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",
    "full stack developer",
    "web developer",
    "разработчик",
    "программист",
    "backend",
    "frontend",
    "fullstack",

    // DevOps / infrastructure
    "devops",
    "devops engineer",
    "devsecops",
    "sre",
    "site reliability",

    // Data / ML
    "data scientist",
    "machine learning engineer",
    "ml engineer",
    "data engineer",

    // Management
    "project manager",
    "product manager",
    "project lead",
    "product lead",
    "менеджер проекта",
    "продакт-менеджер",

    // Other
    "designer",
    "ui/ux",
    "ux designer",
    "recruiter",
    "рекрутер",
    "technical support",
    "support engineer",
    "техническая поддержка"
];


function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}


function isQaPosition(position) {
    const normalized = normalizeText(position);

    const hasQaKeyword = QA_KEYWORDS.some(keyword =>
        normalized.includes(normalizeText(keyword))
    );

    if (!hasQaKeyword) {
        return false;
    }

    const hasExcludedKeyword = EXCLUDED_KEYWORDS.some(keyword =>
        normalized.includes(normalizeText(keyword))
    );

    if (hasExcludedKeyword) {
        return false;
    }

    return true;
}


async function getHabrCareerJobs() {
    console.log("🌐 Opening Habr Career...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    const urls = [
        "https://career.habr.com/vacancies/testirovshik/full_time",
        "https://career.habr.com/vacancies/testirovschik_mobilnyh_prilozheniy/full_time"
    ];

    const jobs = [];

    try {
        for (const url of urls) {
            console.log(`🔎 Parsing: ${url}`);

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForTimeout(1500);

            const vacancyLinks = page.locator(
                'a[href*="/vacancies/"]'
            );

            const count = await vacancyLinks.count();

            console.log(
                `📋 Vacancy links found: ${count}`
            );

            for (let i = 0; i < count; i++) {
                const link = vacancyLinks.nth(i);

                const href = await link.getAttribute("href");
                const text = await link.innerText();

                if (!href || !text) {
                    continue;
                }

                const title = text
                    .replace(/\s+/g, " ")
                    .trim();

                // Проверяем только реальные ссылки на вакансии
                if (
                    !href.match(/^\/vacancies\/\d+/) &&
                    !href.match(
                        /^https:\/\/career\.habr\.com\/vacancies\/\d+/
                    )
                ) {
                    continue;
                }

                // Главный QA-фильтр
                if (!isQaPosition(title)) {
                    continue;
                }

                const fullUrl = href.startsWith("http")
                    ? href
                    : `https://career.habr.com${href}`;

                jobs.push({
                    company: "Unknown",
                    position: title,
                    description: "",
                    url: fullUrl,
                    source: "Habr Career"
                });
            }
        }

        // Удаляем дубликаты
        const uniqueJobs = [
            ...new Map(
                jobs.map(job => [job.url, job])
            ).values()
        ];

        console.log(
            `🎯 Habr Career QA jobs collected: ${uniqueJobs.length}`
        );

        console.table(uniqueJobs);

        return uniqueJobs;

    } catch (error) {
        console.error(
            "❌ Habr Career parser error:"
        );

        console.error(error.message);

        return [];

    } finally {
        await browser.close();
    }
}


module.exports = {
    getHabrCareerJobs,
    isQaPosition
};