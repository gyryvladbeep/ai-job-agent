function normalizeJob(job, source) {
    const company = cleanText(job.company) || "Unknown";

    const position =
        cleanPosition(job.position) || "QA Engineer";

    const description =
        cleanText(job.description) || "";

    const url =
        cleanUrl(job.url);

    return {
        company,
        position,
        description,
        url,
        source: source || job.source || "Unknown",
    };
}


function cleanText(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


function cleanPosition(value) {
    if (!value) {
        return "";
    }

    let position = String(value)
        .replace(/\r/g, "")
        .split("\n")[0]
        .trim();

    // Убираем типичные Telegram-хэштеги
    position = position
        .replace(/#вакансия/gi, "")
        .replace(/#vacancy/gi, "")
        .replace(/#remote/gi, "")
        .replace(/#удаленка/gi, "")
        .replace(/#работа/gi, "")
        .replace(/#qaengineer/gi, "")
        .replace(/#qa/gi, "")
        .replace(/#manual/gi, "")
        .replace(/#auto/gi, "")
        .trim();

    // Убираем лишние пробелы
    position = position
        .replace(/\s+/g, " ")
        .trim();

    return position;
}


function cleanUrl(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .replace(/^\[|\]$/g, "")
        .trim();
}


module.exports = {
    normalizeJob,
};