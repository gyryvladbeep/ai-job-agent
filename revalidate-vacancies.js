/*
 * Разовый скрипт ревалидации базы вакансий.
 *
 * Не трогает записи со статусами "applied" / "interview" / "failed" /
 * "expired" -- это уже принятые решения или уже известные мертвецы,
 * их пересматривать незачем.
 *
 * Для всех остальных ("new" / "notified" / "skipped" -- то есть тех,
 * на которые ты ещё не откликался и не был на интервью) реально
 * проверяет по живой ссылке через isVacancyLive():
 *
 *   - если вакансия уже закрыта -- помечает статус "expired"
 *     (запись не удаляется, просто больше не будет висеть как
 *     "непонятно, актуально или нет");
 *   - если вакансия всё ещё открыта -- попадает в отчёт
 *     still-open-vacancies.md для ручного просмотра.
 *
 * Ничего не откликается и не рассылается автоматически -- это
 * просто чистка статусов + список того, что реально стоит
 * пересмотреть самому.
 *
 * Запуск:
 *   node revalidate-vacancies.js
 */

require("dotenv").config();

const fs = require("fs");
const { supabase, markAsExpired } = require("./src/services/supabase");
const { isVacancyLive } = require("./src/utils/isVacancyLive");

const PAGE_SIZE = 1000;
const CONCURRENCY = 8;
const STATUSES_TO_CHECK = ["new", "notified", "skipped"];

async function fetchVacanciesToCheck() {
    let allRows = [];
    let from = 0;

    while (true) {
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from("vacancies")
            .select("id, company, position, source, status, url, created_at")
            .in("status", STATUSES_TO_CHECK)
            .order("created_at", { ascending: false })
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

// Простой пул с ограничением параллелизма -- без него сотни
// одновременных fetch на разные сайты быстро приводят к таймаутам
// и злят чужие сервера.
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

function formatReportSection(title, rows) {
    if (rows.length === 0) {
        return `## ${title} (0)\n\nНичего нет.\n`;
    }

    const lines = rows.map((row) => {
        const date = row.created_at
            ? new Date(row.created_at).toISOString().slice(0, 10)
            : "?";
        return (
            `- **${row.company || "Unknown"}** -- ${row.position || "?"}\n` +
            `  ${row.url}\n` +
            `  источник: ${row.source || "?"} | добавлено: ${date} | статус: ${row.status}`
        );
    });

    return `## ${title} (${rows.length})\n\n${lines.join("\n\n")}\n`;
}

async function main() {
    console.log("Читаю вакансии со статусами new/notified/skipped из Supabase...");

    const rows = await fetchVacanciesToCheck();

    console.log(`Найдено ${rows.length} вакансий для проверки.`);

    if (rows.length === 0) {
        console.log("Нечего проверять -- база уже чистая по этим статусам.");
        return;
    }

    let checked = 0;
    const stillOpen = [];
    const nowExpired = [];

    await runWithConcurrency(rows, CONCURRENCY, async (row) => {
        const live = await isVacancyLive(row.url);

        checked += 1;
        if (checked % 25 === 0 || checked === rows.length) {
            console.log(`  проверено ${checked}/${rows.length}...`);
        }

        if (live) {
            stillOpen.push(row);
        } else {
            nowExpired.push(row);
            await markAsExpired(row.id);
        }
    });

    // Сортируем живые по дате добавления (новые сверху) для отчёта.
    stillOpen.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const byStatus = {
        new: stillOpen.filter((r) => r.status === "new"),
        notified: stillOpen.filter((r) => r.status === "notified"),
        skipped: stillOpen.filter((r) => r.status === "skipped")
    };

    const report =
        `# Ревалидация базы вакансий -- ${new Date().toISOString().slice(0, 10)}\n\n` +
        `Проверено: ${rows.length}\n` +
        `Всё ещё открыты: ${stillOpen.length}\n` +
        `Помечены как expired (закрыты): ${nowExpired.length}\n\n` +
        "---\n\n" +
        formatReportSection("Новые, ещё не отправленные (new)", byStatus.new) +
        "\n---\n\n" +
        formatReportSection("Отправлены в Telegram, но без реакции (notified)", byStatus.notified) +
        "\n---\n\n" +
        formatReportSection("Явно пропущенные (skipped)", byStatus.skipped);

    fs.writeFileSync("still-open-vacancies.md", report, "utf-8");

    console.log("");
    console.log("=== Готово ===");
    console.log(`Проверено: ${rows.length}`);
    console.log(`Всё ещё открыты: ${stillOpen.length} -> still-open-vacancies.md`);
    console.log(`Помечены как expired: ${nowExpired.length}`);
}

main().catch((error) => {
    console.error("Fatal error:");
    console.error(error);
    process.exit(1);
});
