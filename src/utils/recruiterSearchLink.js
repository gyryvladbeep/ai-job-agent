/*
 * Генерирует ссылку на поиск людей в LinkedIn по компании -- чтобы
 * не искать рекрутера/QA-лида вручную для каждой вакансии. Это
 * только URL, без какой-либо автоматизации самого LinkedIn (это
 * принципиально не трогаем).
 */

function buildRecruiterSearchLink(company) {
    const cleanCompany = String(company || "").trim();

    if (!cleanCompany || cleanCompany === "Unknown") {
        return null;
    }

    const query = encodeURIComponent(
        `${cleanCompany} QA recruiter`
    );

    return `https://www.linkedin.com/search/results/people/?keywords=${query}`;
}

module.exports = {
    buildRecruiterSearchLink
};
