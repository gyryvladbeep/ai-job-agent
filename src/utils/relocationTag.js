/*
 * Лёгкая эвристика: ищем явные признаки релокации/визовой поддержки
 * в тексте вакансии. Это дополнительная метка поверх обычного QA-
 * фильтра, а не замена ему и не отдельный фильтр -- специально
 * сделано так, чтобы не трогать основной поток вакансий (по запросу
 * пользователя), только добавлять один необязательный штрих в
 * уведомление, когда сигнал реально есть.
 */

const RELOCATION_KEYWORDS = [
    "relocation",
    "relocation package",
    "relocation support",
    "relocation assistance",
    "visa sponsorship",
    "visa support",
    "work permit",
    "sponsor a visa",
    "relocate",

    "релокация",
    "релокационный пакет",
    "визовая поддержка",
    "помощь с визой",
    "визовое сопровождение",
    "оформление визы",
    "переезд"
];

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}

function hasRelocationSignal(job) {
    const haystack = normalize(
        `${job.position || ""} ${job.description || ""}`
    );

    if (!haystack) {
        return false;
    }

    return RELOCATION_KEYWORDS.some(keyword =>
        haystack.includes(normalize(keyword))
    );
}

module.exports = {
    hasRelocationSignal
};
