require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { createLogger } = require("../core/logger");

const logger = createLogger("Supabase");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Проверяем, существует ли вакансия по URL
async function jobExists(url) {
    const { data, error } = await supabase
        .from("vacancies")
        .select("id")
        .eq("url", url)
        .maybeSingle();

    if (error) {
        logger.error("error checking vacancy:", error);
        return false;
    }

    return !!data;
}

// Сохраняем новые вакансии
async function saveJobs(jobs) {
    if (!jobs || jobs.length === 0) {
        logger.info("no jobs to save");
        return [];
    }

    const jobsToSave = jobs.map((job) => ({
        company: job.company,
        position: job.position,
        description: job.description || null,
        url: job.url,
        source: job.source || "Unknown",
        status: "new"
    }));

    const { data, error } = await supabase
        .from("vacancies")
        .insert(jobsToSave)
        .select();

    if (error) {
        logger.error("error saving jobs:", error);
        return [];
    }

    logger.info(`saved ${data.length} jobs to Supabase`);

    return data;
}

// Помечаем вакансию как отправленную в Telegram
async function markAsNotified(id) {
    const { error } = await supabase
        .from("vacancies")
        .update({ status: "notified" })
        .eq("id", id);

    if (error) {
        logger.error("error updating vacancy status:", error);
        return false;
    }

    logger.info(`vacancy ${id} marked as notified`);

    return true;
}

// Помечаем вакансию как ошибочную
async function markAsFailed(id) {
    const { error } = await supabase
        .from("vacancies")
        .update({ status: "failed" })
        .eq("id", id);

    if (error) {
        logger.error("error marking vacancy as failed:", error);
        return false;
    }

    logger.warn(`vacancy ${id} marked as failed`);

    return true;
}

// Помечаем вакансию как истёкшую/закрытую -- нашли её новой, но
// проверка перед отправкой показала, что она уже не принимает
// отклики. Отдельный статус, а не "failed": это не ошибка
// парсинга/сети, сама вакансия закрыта.
async function markAsExpired(id) {
    const { error } = await supabase
        .from("vacancies")
        .update({ status: "expired" })
        .eq("id", id);

    if (error) {
        logger.error("error marking vacancy as expired:", error);
        return false;
    }

    logger.warn(`vacancy ${id} marked as expired`);

    return true;
}

// Записываем статус, который пользователь выбрал кнопкой в Telegram
// под уведомлением (см. src/services/telegramListener.js) --
// "applied" / "skipped" / "interview". Один общий сеттер вместо трёх
// одинаковых функций, потому что логика буквально идентична.
async function setVacancyStatus(id, status) {
    const { error } = await supabase
        .from("vacancies")
        .update({ status })
        .eq("id", id);

    if (error) {
        logger.error(`error setting vacancy ${id} status to "${status}":`, error);
        return false;
    }

    logger.info(`vacancy ${id} status set to "${status}"`);

    return true;
}

// Возвращаем ВСЕ вакансии из таблицы -- нужно для разовых массовых
// проверок вроде src/recheckVacancies.js. Supabase/PostgREST отдаёт
// максимум 1000 строк за один select, поэтому листаем через .range(),
// пока не придёт страница короче PAGE_SIZE.
async function getAllVacancies() {
    const PAGE_SIZE = 1000;
    const all = [];
    let from = 0;

    for (;;) {
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from("vacancies")
            .select("*")
            .order("id", { ascending: true })
            .range(from, to);

        if (error) {
            logger.error("error fetching all vacancies:", error);
            break;
        }

        if (!data || data.length === 0) {
            break;
        }

        all.push(...data);

        if (data.length < PAGE_SIZE) {
            break;
        }

        from += PAGE_SIZE;
    }

    logger.info(`fetched ${all.length} vacancies total`);

    return all;
}

// Безвозвратно удаляем вакансию из базы -- используется при разовой
// чистке (src/recheckVacancies.js), когда повторная проверка
// показала, что вакансия больше не актуальна и хранить запись дальше
// нет смысла.
async function deleteJob(id) {
    const { error } = await supabase
        .from("vacancies")
        .delete()
        .eq("id", id);

    if (error) {
        logger.error(`error deleting vacancy ${id}:`, error);
        return false;
    }

    logger.warn(`vacancy ${id} deleted`);

    return true;
}

module.exports = {
    supabase,
    jobExists,
    saveJobs,
    markAsNotified,
    markAsFailed,
    markAsExpired,
    setVacancyStatus,
    getAllVacancies,
    deleteJob
};
