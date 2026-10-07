/*
 * Чистая функция -- считает вакансии по статусу. Вынесена отдельно
 * от src/clearVacancies.js по тому же принципу, что и
 * src/core/recheckDecision.js: сам clearVacancies.js подключает
 * services/supabase.js, которая требует настоящих переменных
 * окружения при импорте и упадёт в среде без .env (например в CI).
 */

function summarizeByStatus(jobs) {
    const byStatus = {};

    for (const job of jobs || []) {
        if (!job || typeof job.status !== "string") {
            continue;
        }

        byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    }

    return byStatus;
}

module.exports = {
    summarizeByStatus
};
