require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

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
        console.error("❌ Error checking vacancy:");
        console.error(error);
        return false;
    }

    return !!data;
}

// Сохраняем новые вакансии
async function saveJobs(jobs) {
    if (!jobs || jobs.length === 0) {
        console.log("ℹ️ No jobs to save");
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
        console.error("❌ Error saving jobs:");
        console.error(error);
        return [];
    }

    console.log(`✅ Saved ${data.length} jobs to Supabase`);

    return data;
}

// Помечаем вакансию как отправленную в Telegram
async function markAsNotified(id) {
    const { error } = await supabase
        .from("vacancies")
        .update({
            status: "notified"
        })
        .eq("id", id);

    if (error) {
        console.error("❌ Error updating vacancy status:");
        console.error(error);
        return false;
    }

    console.log(`✅ Vacancy ${id} marked as notified`);

    return true;
}

// Помечаем вакансию как ошибочную
async function markAsFailed(id) {
    const { error } = await supabase
        .from("vacancies")
        .update({
            status: "failed"
        })
        .eq("id", id);

    if (error) {
        console.error("❌ Error marking vacancy as failed:");
        console.error(error);
        return false;
    }

    console.log(`⚠️ Vacancy ${id} marked as failed`);

    return true;
}

module.exports = {
    supabase,
    jobExists,
    saveJobs,
    markAsNotified,
    markAsFailed
};