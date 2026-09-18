/*
 * Лёгкая эвристическая проверка "вакансия ещё жива" перед тем как
 * слать уведомление -- чтобы не тратить время на отклик по мёртвой
 * ссылке. Это best-effort, не гарантия: многие сайты рендерят
 * статус вакансии через JS, а здесь просто читаем статический HTML.
 *
 * Принцип fail-open: любая ошибка проверки (таймаут, сеть, блок по
 * User-Agent и т.д.) считается "вакансия жива" -- мы никогда не
 * должны молчать про реальную новую вакансию только потому, что
 * сама проверка не сработала.
 */

const TIMEOUT_MS = 8000;

const CLOSED_PHRASES = [
    "vacancy is closed",
    "vacancy has closed",
    "this position has been filled",
    "this position is no longer available",
    "no longer accepting applications",
    "job has expired",
    "vacancy expired",
    "posting has expired",
    "this job is no longer active",
    "applications are closed",

    "вакансия закрыта",
    "вакансия больше не актуальна",
    "вакансия неактивна",
    "приём заявок завершён",
    "вакансия в архиве",
    "вакансия недоступна"
];

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ");
}

async function isVacancyLive(url) {
    if (!url) {
        return true;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/151.0.0.0 Safari/537.36"
            }
        });

        if (response.status === 404 || response.status === 410) {
            return false;
        }

        if (!response.ok) {
            // Не 2xx, но и не однозначное "нет такой страницы" --
            // не рискуем молчать про вакансию из-за нестандартного
            // ответа сервера (403 от анти-бота и т.п.).
            return true;
        }

        const html = await response.text();
        const normalized = normalize(html);

        const looksClosedText = CLOSED_PHRASES.some(phrase =>
            normalized.includes(normalize(phrase))
        );

        return !looksClosedText;

    } catch (error) {
        return true;

    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    isVacancyLive
};
