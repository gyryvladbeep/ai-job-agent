/*
 * Прямой мониторинг карьерных страниц конкретных компаний вместо
 * агрегаторов -- обходит шум ATS-агрегаторов и даёт доступ к
 * "скрытому" рынку вакансий напрямую у работодателя.
 *
 * Все компании ниже проверены вручную (WebFetch, 2026-09-18): у
 * каждой подтверждён рабочий публичный JSON API её ATS (Greenhouse
 * или Ashby), поэтому здесь не нужен Playwright/браузер вообще --
 * просто fetch + JSON. Быстрее и надёжнее DOM-скрейпинга, и такие
 * API не подвержены Cloudflare-блокам, с которыми боремся у других
 * источников.
 *
 * То, что у конкретной компании сегодня 0 QA-вакансий -- это
 * реальность рынка на день проверки, а не баг парсера: список
 * досок время от времени стоит пересматривать и дополнять.
 */

const TIMEOUT_MS = 15000;

const GREENHOUSE_BOARDS = [
    { slug: "elastic", company: "Elastic" },
    { slug: "mongodb", company: "MongoDB" },
    { slug: "twilio", company: "Twilio" },
    { slug: "grafanalabs", company: "Grafana Labs" },
    { slug: "gitlab", company: "GitLab" },
    { slug: "smartbear", company: "SmartBear" },
    { slug: "canonical", company: "Canonical" }
];

const ASHBY_BOARDS = [
    { slug: "confluent", company: "Confluent" },
    { slug: "zapier", company: "Zapier" }
];

function stripHtml(html) {
    return String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/151.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            console.log(
                `⚠️ ${url}: HTTP ${response.status}`
            );
            return null;
        }

        return await response.json();

    } catch (error) {
        console.log(
            `⚠️ ${url}: request failed -- ${error?.message || error}`
        );
        return null;

    } finally {
        clearTimeout(timer);
    }
}

async function fetchGreenhouseBoard({ slug, company }) {
    const url =
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

    const data = await fetchJson(url);

    if (!data || !Array.isArray(data.jobs)) {
        return [];
    }

    return data.jobs.map(job => ({
        company,
        position: job.title || "",
        description: stripHtml(job.content),
        url: job.absolute_url,
        source: `Direct: ${company}`
    }));
}

async function fetchAshbyBoard({ slug, company }) {
    const url =
        `https://api.ashbyhq.com/posting-api/job-board/${slug}`;

    const data = await fetchJson(url);

    if (!data || !Array.isArray(data.jobs)) {
        return [];
    }

    return data.jobs.map(job => ({
        company,
        position: job.title || "",
        description: job.descriptionPlain || "",
        url: job.jobUrl || job.applyUrl,
        source: `Direct: ${company}`
    }));
}

async function getCompanyBoardJobs() {
    console.log("🌐 Checking direct company career boards...");

    const results = await Promise.all([
        ...GREENHOUSE_BOARDS.map(fetchGreenhouseBoard),
        ...ASHBY_BOARDS.map(fetchAshbyBoard)
    ]);

    const jobs = results.flat().filter(job => job.position && job.url);

    const uniqueJobs = [
        ...new Map(jobs.map(job => [job.url, job])).values()
    ];

    console.log(
        `🎯 Direct company boards: ${uniqueJobs.length} jobs collected across ${GREENHOUSE_BOARDS.length + ASHBY_BOARDS.length} companies`
    );

    return uniqueJobs;
}

module.exports = {
    getCompanyBoardJobs
};
