/*
 * Single source of truth for "is this a QA/testing job". Before the
 * 2026-09-22 architecture rewrite this same classification existed
 * in FOUR places that had quietly drifted apart: this file, plus a
 * local copy inside geekjob.js, habrCareer.js and telegramWeb.js.
 * That drift is exactly what caused the Direct Company Boards
 * source (10000+ raw jobs/run) to have almost everything filtered
 * out here even though geekjob/habrCareer/telegramWeb's own,
 * slightly richer lists would have matched plenty of it.
 *
 * Every parser that needs a local QA check now imports isQaJob (or
 * matchesQa, for sources that want to check description text too)
 * from here instead of keeping its own list.
 */

const QA_KEYWORDS = [
    // English
    "qa engineer",
    "qa automation",
    "automation qa",
    "automation tester",
    "automation test engineer",
    "automation engineer",
    "qa automation engineer",
    "test automation engineer",
    "test automation",
    "test engineer",
    "software tester",
    "qa tester",
    "quality assurance engineer",
    "quality assurance analyst",
    "quality assurance",
    "quality engineer",
    "software quality engineer",
    "software quality assurance",
    "software test engineer",
    "sdet",
    "manual qa",
    "manual tester",
    "manual test engineer",
    "qa analyst",
    "test analyst",
    "test specialist",
    "testing engineer",
    "qa specialist",
    "qa lead",
    "qa manager",
    "senior qa",
    "middle qa",
    "middle manual qa",
    "junior qa",
    "lead qa",

    // Russian
    "тестировщик",
    "тестирование",
    "инженер по тестированию",
    "специалист по тестированию",
    "автоматизатор тестирования",
    "автотестировщик",
    "тестировщик автоматизации",
    "инженер qa",
    "qa-инженер",
    "qa инженер",
    "qa специалист",
    "инженер по качеству",
    "инженер качества",
    "специалист по качеству",
    "контроль качества по",
    "тестирование по",
    "старший тестировщик",
    "ведущий тестировщик",
    "ручное тестирование",
    "ручной тестировщик",
    "автоматизированное тестирование",
    "автоматизация тестирования",
    "тестировщик мобильных приложений",
    "тестировщик веб-приложений",
    "тестировщик api"
];

const EXCLUDED_KEYWORDS = [
    // Analysts
    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",
    "financial analyst",
    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",
    "продуктовый аналитик",
    "финансовый аналитик",

    // Development
    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",
    "full stack developer",
    "web developer",
    "mobile developer",
    "android developer",
    "ios developer",
    "backend",
    "frontend",
    "fullstack",
    "разработчик",
    "программист",
    "backend-разработчик",
    "frontend-разработчик",
    "fullstack-разработчик",

    // DevOps / infrastructure
    "devops",
    "devops engineer",
    "devsecops",
    "site reliability",
    "site reliability engineer",
    "sre",
    "platform engineer",
    "девопс",

    // Data / ML
    "data scientist",
    "machine learning engineer",
    "ml engineer",
    "data engineer",

    // Management
    "project manager",
    "product manager",
    "program manager",
    "engineering manager",
    "project lead",
    "product lead",
    "менеджер проекта",
    "руководитель проекта",
    "продакт-менеджер",
    "продуктовый менеджер",

    // Other
    "designer",
    "ui designer",
    "ux designer",
    "ui/ux",
    "дизайнер",
    "recruiter",
    "recruitment",
    "рекрутер",
    "support engineer",
    "technical support",
    "customer support",
    "техническая поддержка",
    "служба поддержки"
];

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[ё]/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}

/*
 * Lower-level check against an arbitrary piece of text (title alone,
 * or title+description). Most sources only ever want the title
 * checked -- a developer posting that merely mentions QA in its
 * description shouldn't count -- but Telegram job-channel posts are
 * unstructured enough that checking the whole message text is more
 * reliable than trying to isolate a "title".
 */
function matchesQa(text) {
    const normalized = normalize(text);

    if (!normalized) {
        return false;
    }

    const hasQaKeyword = QA_KEYWORDS.some(keyword =>
        normalized.includes(normalize(keyword))
    );

    if (!hasQaKeyword) {
        return false;
    }

    const hasExcludedKeyword = EXCLUDED_KEYWORDS.some(keyword =>
        normalized.includes(normalize(keyword))
    );

    return !hasExcludedKeyword;
}

function isQaJob(job) {
    return matchesQa(job.position);
}

function filterQaJobs(jobs) {
    const filtered = jobs.filter(isQaJob);

    console.log(
        `[qaFilter] ${filtered.length}/${jobs.length} jobs passed`
    );

    return filtered;
}

module.exports = {
    QA_KEYWORDS,
    EXCLUDED_KEYWORDS,
    normalize,
    matchesQa,
    isQaJob,
    filterQaJobs
};
