const QA_KEYWORDS = [
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

    "тестировщик",
    "тестирование",
    "инженер по тестированию",
    "специалист по тестированию",
    "автоматизатор тестирования",
    "инженер qa",
    "инженер по качеству",
    "инженер по качеству по"
];

const EXCLUDED_KEYWORDS = [
    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",

    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",

    "devops",
    "devsecops",
    "sre",

    "data scientist",
    "machine learning engineer",
    "ml engineer",

    "project manager",
    "product manager",

    "designer",
    "recruiter",
    "support engineer",
    "technical support",

    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",
    "продуктовый аналитик",

    "разработчик",
    "программист",

    "девопс",
    "дизайнер",
    "рекрутер",

    "менеджер проекта",
    "продакт-менеджер"
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