const QA_KEYWORDS = [
    // Добавлено 2026-09-22: список был заметно уже, чем в
    // telegramWeb.js -- из-за этого из 10000+ вакансий Direct
    // Company Boards глобальный фильтр пропускал буквально единицы
    // (реальные QA-вакансии есть, но называются "Quality Engineer",
    // "QA Specialist", "Software Test Engineer" и т.д. -- слов не
    // было в списке). Синхронизировано с более полным списком из
    // telegramWeb.js плюс несколько новых вариантов.
    "qa engineer",
    "qa automation",
    "automation qa",
    "automation tester",
    "automation test engineer",
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
    "junior qa",
    "lead qa",

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
    "инженер по качеству по",
    "инженер качества",
    "специалист по качеству",
    "контроль качества по",
    "тестирование по",
    "старший тестировщик",
    "ведущий тестировщик"
];

const EXCLUDED_KEYWORDS = [
    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",
    "financial analyst",

    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",
    "full stack developer",
    "mobile developer",
    "android developer",
    "ios developer",

    "devops",
    "devsecops",
    "site reliability engineer",
    "sre",
    "platform engineer",

    "data scientist",
    "machine learning engineer",
    "ml engineer",
    "data engineer",

    "project manager",
    "product manager",
    "program manager",
    "engineering manager",

    "designer",
    "ui designer",
    "ux designer",

    "recruiter",
    "recruitment",

    "support engineer",
    "technical support",
    "customer support",

    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",
    "продуктовый аналитик",
    "финансовый аналитик",

    "разработчик",
    "программист",
    "backend-разработчик",
    "frontend-разработчик",
    "fullstack-разработчик",

    "девопс",
    "дизайнер",
    "рекрутер",

    "менеджер проекта",
    "руководитель проекта",
    "продакт-менеджер",
    "продуктовый менеджер",

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

function isQaJob(job) {
    const position = normalize(job.position);

    if (!position) {
        return false;
    }

    // Проверяем только название вакансии.
    // Это важно: разработчик с упоминанием QA
    // в описании не должен попадать в наши вакансии.
    const hasQaKeyword = QA_KEYWORDS.some(keyword =>
        position.includes(normalize(keyword))
    );

    if (!hasQaKeyword) {
        return false;
    }

    const hasExcludedTitle = EXCLUDED_KEYWORDS.some(keyword =>
        position.includes(normalize(keyword))
    );

    if (hasExcludedTitle) {
        return false;
    }

    return true;
}

function filterQaJobs(jobs) {
    const filtered = jobs.filter(isQaJob);

    console.log(
        `🔎 QA filter: ${filtered.length}/${jobs.length} jobs passed`
    );

    return filtered;
}

module.exports = {
    isQaJob,
    filterQaJobs
};
