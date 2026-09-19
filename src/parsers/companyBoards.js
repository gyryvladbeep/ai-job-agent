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
    { slug: "canonical", company: "Canonical" },

    // Добавлено 2026-09-19 -- список из 40 кандидатов, каждый slug
    // проверен вручную (WebFetch) перед добавлением. 12 кандидатов
    // не нашли рабочей доски ни на Greenhouse, ни на Ashby, ни на
    // Lever (Monday.com, ClickUp, Miro, Retool, Snyk, 1Password,
    // DigitalOcean, Codecov, Sentry, Chargebee, Rippling, Loom) --
    // не угадываю их API дальше, у них либо кастомный сайт, либо
    // Workday/другая закрытая система, для которой нужен отдельный
    // DOM-парсер, а не эта generic-схема.
    { slug: "figma", company: "Figma" },
    { slug: "airtable", company: "Airtable" },
    { slug: "asana", company: "Asana" },
    { slug: "webflow", company: "Webflow" },
    { slug: "vercel", company: "Vercel" },
    { slug: "netlify", company: "Netlify" },
    { slug: "amplitude", company: "Amplitude" },
    { slug: "mixpanel", company: "Mixpanel" },
    { slug: "datadog", company: "Datadog" },
    { slug: "newrelic", company: "New Relic" },
    { slug: "pagerduty", company: "PagerDuty" },
    { slug: "okta", company: "Okta" },
    { slug: "cloudflare", company: "Cloudflare" },
    { slug: "fastly", company: "Fastly" },
    { slug: "circleci", company: "CircleCI" },
    { slug: "launchdarkly", company: "LaunchDarkly" },
    { slug: "stripe", company: "Stripe" },
    { slug: "brex", company: "Brex" },
    { slug: "remotecom", company: "Remote" },
    { slug: "gusto", company: "Gusto" },
    { slug: "calendly", company: "Calendly" },
    { slug: "typeform", company: "Typeform" },

    // Добавлено 2026-09-19 (второй раунд) -- ещё 50+ кандидатов
    // проверено вручную (WebFetch) перед добавлением на этот раз.
    { slug: "intercom", company: "Intercom" },
    { slug: "algolia", company: "Algolia" },
    { slug: "contentful", company: "Contentful" },
    { slug: "jfrog", company: "JFrog" },
    { slug: "sumologic", company: "Sumo Logic" },
    { slug: "pendo", company: "Pendo" },
    { slug: "braze", company: "Braze" },
    { slug: "iterable", company: "Iterable" },
    { slug: "customerio", company: "Customer.io" },
    { slug: "klaviyo", company: "Klaviyo" },
    { slug: "fivetran", company: "Fivetran" },
    { slug: "databricks", company: "Databricks" },
    { slug: "dremio", company: "Dremio" },
    { slug: "neo4j", company: "Neo4j" },
    { slug: "cockroachlabs", company: "Cockroach Labs" },
    { slug: "scaleai", company: "Scale AI" },
    { slug: "labelbox", company: "Labelbox" },
    { slug: "assemblyai", company: "AssemblyAI" },
    { slug: "mercury", company: "Mercury" },
    { slug: "carta", company: "Carta" },
    { slug: "descript", company: "Descript" },
    { slug: "justworks", company: "Justworks" },
    { slug: "affirm", company: "Affirm" },
    { slug: "chime", company: "Chime" },
    { slug: "checkr", company: "Checkr" },
    { slug: "salesloft", company: "Salesloft" }
];

const ASHBY_BOARDS = [
    { slug: "confluent", company: "Confluent" },
    { slug: "zapier", company: "Zapier" },

    // Добавлено 2026-09-19, тоже проверено вручную.
    { slug: "notion", company: "Notion" },
    { slug: "linear", company: "Linear" },
    { slug: "render", company: "Render" },
    { slug: "ramp", company: "Ramp" },
    { slug: "plaid", company: "Plaid" },
    { slug: "deel", company: "Deel" },

    // Добавлено 2026-09-19 (второй раунд), тоже проверено вручную.
    { slug: "openai", company: "OpenAI" },
    { slug: "vanta", company: "Vanta" },
    { slug: "posthog", company: "PostHog" },
    { slug: "clerk", company: "Clerk" },
    { slug: "workos", company: "WorkOS" },
    { slug: "resend", company: "Resend" },
    { slug: "knock", company: "Knock" },
    { slug: "elevenlabs", company: "ElevenLabs" },
    { slug: "modal", company: "Modal" },
    { slug: "anyscale", company: "Anyscale" },
    { slug: "cohere", company: "Cohere" },
    { slug: "weaviate", company: "Weaviate" },
    { slug: "substack", company: "Substack" },
    { slug: "watershed", company: "Watershed" },
    { slug: "mercor", company: "Mercor" },
    { slug: "decagon", company: "Decagon" },
    { slug: "sierra", company: "Sierra" },
    { slug: "harvey", company: "Harvey" },
    { slug: "abridge", company: "Abridge" },
    { slug: "supabase", company: "Supabase" },
    { slug: "temporal", company: "Temporal" },
    { slug: "synthesia", company: "Synthesia" },
    { slug: "cursor", company: "Cursor" },
    { slug: "n8n", company: "n8n" },
    { slug: "pinecone", company: "Pinecone" },
    { slug: "writer", company: "Writer" },
    { slug: "speak", company: "Speak" },
    { slug: "lovable", company: "Lovable" },
    { slug: "vapi", company: "Vapi" },
    { slug: "bland", company: "Bland" },
    { slug: "baseten", company: "Baseten" }
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
