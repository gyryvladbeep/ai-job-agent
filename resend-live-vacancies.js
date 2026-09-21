/*
 * Разовый скрипт: прислать в Telegram ВСЕ вакансии, которые уже
 * лежат в базе, но ты по ним ещё ничего не решил -- статусы
 * "new" (собраны, но по какой-то причине не дошли до отправки),
 * "notified" (были отправлены раньше, ты не нажал ни одну кнопку),
 * "skipped" (нажал "Skipped", но хочешь пересмотреть) и "failed"
 * (отправка тогда не удалась технически).
 *
 * "applied" / "interview" / "expired" не трогает -- это уже принятые
 * решения или уже известные мертвецы.
 *
 * Перед отправкой каждая вакансия реально проверяется через
 * isVacancyLive() -- если она уже закрыта, в Telegram не летит,
 * статус становится "expired". Если жива -- уходит обычным
 * уведомлением через тот же sendJob(), что и в основном пайплайне
 * (те же кнопки Applied/Skipped/Interview), и статус становится
 * "notified".
 *
 * Отправка идёт с паузой ~1.2 сек между сообщениями в один и тот же
 * чат -- это ограничение самого Telegram, а не искусственное: без
 * паузы после нескольких десятков сообщений подряд Telegram начинает
 * отвечать "429 Too Many Requests" и часть уведомлений теряется.
 * Поэтому если вакансий в базе много, скрипт будет работать не
 * секунды, а минуты -- прогресс видно в консоли.
 *
 * Ничего не откликается автоматически -- только уведомления.
 *
 * Запуск:
 *   node resend-live-vacancies.js
 */

require("dotenv").config();

const {
    supabase,
    markAsExpired,
    markAsNotified
} = require("./src/services/supabase");

const { sendJob } = require("./src/services/telegram");
const { isVacancyLive } = require("./src/utils/isVacancyLive");

const PAGE_SIZE = 1000;
const CHECK_CONCURRENCY = 8;
const SEND_DELAY_MS = 1200;
const STATUSES_TO_RESEND = ["new", "notified", "skipped", "failed"];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVacanciesToResend() {
    let allRows = [];
    let from = 0;

    while (true) {
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from("vacancies")
            .select("id, company, position, source, status, url, description, created_at")
            .in("status", STATUSES_TO_RESEND)
            .order("created_at", { ascending: true })
            .range(from, to);

        if (error) {
            console.error("Error reading vacancies:");
            console.error(error);
            process.exit(1);
        }

        allRows = allRows.concat(data);

        if (data.length < PAGE_SIZE) {
            break;
        }

        from += PAGE_SIZE;
    }

    return allRows;
}

// Тот же пул с ограничением параллелизма, что и в
// revalidate-vacancies.js -- для проверки "жива ли ссылка" можно
// бить пачками, это просто GET-запросы на разные сайты. А вот
// отправку в Telegram (ниже, в main) параллелить нельзя -- все
// сообщения летят в один чат.
async function runWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runOne() {
        while (nextIndex < items.length) {
            const current = nextIndex;
            nextIndex += 1;
            results[current] = await worker(items[current], current);
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        runOne
    );

    await Promise.all(workers);

    return results;
}

async function main() {
    console.log("Читаю вакансии со статусами new/notified/skipped/failed из Supabase...");

    const rows = await fetchVacanciesToResend();

    console.log(`Найдено ${rows.length} вакансий-кандидатов.`);

    if (rows.length === 0) {
        console.log("Нечего пересылать -- таких вакансий в базе нет.");
        return;
    }

    console.log("Проверяю, какие из них всё ещё живы...");

    let checked = 0;
    const liveJobs = [];
    const deadJobs = [];

    await runWithConcurrency(rows, CHECK_CONCURRENCY, async (row) => {
        const live = await isVacancyLive(row.url);

        checked += 1;
        if (checked % 25 === 0 || checked === rows.length) {
            console.log(`  проверено ${checked}/${rows.length}...`);
        }

        if (live) {
            liveJobs.push(row);
        } else {
            deadJobs.push(row);
            await markAsExpired(row.id);
        }
    });

    console.log("");
    console.log(`Живых вакансий к отправке: ${liveJobs.length}`);
    console.log(`Закрытых (помечены expired): ${deadJobs.length}`);

    if (liveJobs.length === 0) {
        console.log("Отправлять нечего -- всё, что было в базе по этим статусам, уже закрыто.");
        return;
    }

    // Сортируем от старых к новым, чтобы в Telegram лента шла в
    // логичном хронологическом порядке, а не вперемешку.
    liveJobs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const estimatedSeconds = Math.ceil((liveJobs.length * SEND_DELAY_MS) / 1000);
    console.log(
        `Начинаю отправку в Telegram (~${estimatedSeconds} сек с учётом паузы между сообщениями)...`
    );
    console.log("");

    let sent = 0;
    let sendErrors = 0;

    for (const job of liveJobs) {
        const ok = await sendJob(job);

        if (ok) {
            sent++;
            await markAsNotified(job.id);
            console.log(`  [${sent}/${liveJobs.length}] отправлено: ${job.company} -- ${job.position}`);
        } else {
            sendErrors++;
            console.log(`  [!] не удалось отправить: ${job.company} -- ${job.position}`);
        }

        await sleep(SEND_DELAY_MS);
    }

    console.log("");
    console.log("=== Готово ===");
    console.log(`Проверено всего: ${rows.length}`);
    console.log(`Отправлено в Telegram: ${sent}`);
    console.log(`Ошибок отправки: ${sendErrors}`);
    console.log(`Помечено как expired (закрыты): ${deadJobs.length}`);
}

main().catch((error) => {
    console.error("Fatal error:");
    console.error(error);
    process.exit(1);
});
