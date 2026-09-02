const { chromium } = require("playwright");


// ==========================================
// TELEGRAM CHANNELS
// ==========================================
//
// Добавляй сюда новые публичные Telegram-каналы.
// Формат: только username без @
//
// Парсер использует:
// https://t.me/s/USERNAME
//
// Поэтому работают только публичные каналы,
// у которых доступна web-preview страница.
// ==========================================

const TELEGRAM_CHANNELS = [

    // ======================================
    // EXISTING QA CHANNELS
    // ======================================

    "qa_jobs",
    "qajobsru",
    "qa_chillout_jobs",
    "wantapply_qa_jobs",
    "youritjob",
    "jobforjunior",
    "qa_rab",


    // ======================================
    // ADDITIONAL QA / IT JOB CHANNELS
    // ======================================

    "qa_jobs_ru",
    "qa_jobs_channel",
    "qa_jobs_tg",
    "qa_vacancies",
    "qa_job",
    "qa_work",
    "it_jobs",
    "it_vacancies",
    "it_job",
    "it_jobs_ru",
    "remote_jobs_ru",
    "remoteit",
    "remote_jobs",
    "dev_jobs",
    "ru_it_jobs",
    "rabota_it"
];


// ==========================================
// SETTINGS
// ==========================================

// Сколько последних сообщений читать
// из каждого канала.
//
// 200 достаточно для текущего запуска.
// Supabase сам уберет уже известные вакансии.

const MESSAGES_PER_CHANNEL = 200;


// ==========================================
// NORMALIZE
// ==========================================

function normalize(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/[ё]/g, "е")
        .replace(/\s+/g, " ")
        .trim();
}


// ==========================================
// QA KEYWORDS
// ==========================================

const QA_KEYWORDS = [

    // ======================================
    // ENGLISH
    // ======================================

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
    "software quality assurance",
    "quality assurance",
    "quality engineer",
    "qa specialist",
    "qa analyst",
    "test analyst",
    "software test engineer",
    "software quality engineer",
    "test specialist",
    "testing engineer",
    "sdet",

    "manual qa",
    "manual tester",
    "manual test engineer",

    "automation engineer",
    "qa automation engineer",
    "senior qa",
    "middle qa",
    "middle manual qa",
    "junior qa",
    "qa lead",
    "qa manager",

    // ======================================
    // RUSSIAN
    // ======================================

    "тестировщик",
    "инженер по тестированию",
    "специалист по тестированию",
    "автоматизатор тестирования",
    "инженер qa",
    "qa-инженер",
    "qa инженер",
    "инженер по качеству",
    "инженер тестирования",
    "тестировщик по",
    "автотестировщик",
    "тестировщик автоматизации",
    "специалист по качеству",
    "инженер качества",
    "контроль качества по",
    "тестирование по",

    "ручное тестирование",
    "ручной тестировщик",
    "автоматизированное тестирование",
    "автоматизация тестирования",

    "старший тестировщик",
    "ведущий тестировщик",
    "qa специалист",
    "qa специалист по тестированию",
    "qa инженер",

    "тестировщик мобильных приложений",
    "тестировщик веб-приложений",
    "тестировщик api"
];


// ==========================================
// EXCLUDED KEYWORDS
// ==========================================
//
// Проверяются преимущественно в названии,
// чтобы не выкидывать QA-вакансии,
// где в описании просто упоминается developer,
// analyst и т.д.
// ==========================================

const EXCLUDED_KEYWORDS = [

    // ======================================
    // ANALYST
    // ======================================

    "system analyst",
    "business analyst",
    "data analyst",
    "product analyst",
    "financial analyst",

    "системный аналитик",
    "бизнес-аналитик",
    "аналитик данных",
    "продуктовый аналитик",
    "финансовый аналитик",

    // ======================================
    // DEVELOPMENT
    // ======================================

    "developer",
    "software developer",
    "backend developer",
    "frontend developer",
    "fullstack developer",
    "full stack developer",
    "mobile developer",
    "android developer",
    "ios developer",

    "разработчик",
    "программист",
    "backend-разработчик",
    "frontend-разработчик",
    "fullstack-разработчик",

    // ======================================
    // DEVOPS / INFRASTRUCTURE
    // ======================================

    "devops",
    "devsecops",
    "site reliability engineer",
    "sre",
    "platform engineer",

    "девопс",

    // ======================================
    // DATA / ML
    // ======================================

    "data scientist",
    "machine learning engineer",
    "ml engineer",
    "data engineer",

    "машинное обучение",
    "инженер по данным",

    // ======================================
    // MANAGEMENT
    // ======================================

    "project manager",
    "product manager",
    "program manager",
    "engineering manager",

    "менеджер проекта",
    "руководитель проекта",
    "продакт-менеджер",
    "продуктовый менеджер",

    // ======================================
    // OTHER
    // ======================================

    "designer",
    "ui designer",
    "ux designer",

    "дизайнер",

    "recruiter",
    "recruitment",

    "рекрутер",
    "hr",

    "technical support",
    "customer support",
    "support engineer",

    "техническая поддержка",
    "служба поддержки"
];


// ==========================================
// QA DETECTION
// ==========================================

function isQaJob(job) {

    const position = normalize(job.position);

    const description = normalize(
        job.description
    );

    const text = `${position} ${description}`;


    // ======================================
    // 1. QA KEYWORD
    // ======================================

    const hasQaKeyword =
        QA_KEYWORDS.some(keyword =>
            text.includes(
                normalize(keyword)
            )
        );


    if (!hasQaKeyword) {
        return false;
    }


    // ======================================
    // 2. EXCLUDED TITLE
    // ======================================

    const hasExcludedTitle =
        EXCLUDED_KEYWORDS.some(keyword =>
            position.includes(
                normalize(keyword)
            )
        );


    if (hasExcludedTitle) {
        return false;
    }


    return true;
}


// ==========================================
// COMPANY + POSITION
// ==========================================

function extractCompanyAndPosition(text) {

    const cleanText =
        String(text || "")
            .replace(/\s+/g, " ")
            .trim();


    if (!cleanText) {

        return {
            company: "Unknown",
            position: "Unknown"
        };
    }


    // ======================================
    // Company / Position
    // ======================================

    if (cleanText.includes(" / ")) {

        const parts =
            cleanText.split(" / ");

        return {

            company:
                parts[0].trim() ||
                "Unknown",

            position:
                parts
                    .slice(1)
                    .join(" / ")
                    .trim()
        };
    }


    // ======================================
    // Company — Position
    // ======================================

    if (cleanText.includes(" — ")) {

        const parts =
            cleanText.split(" — ");

        return {

            company:
                parts[0].trim() ||
                "Unknown",

            position:
                parts
                    .slice(1)
                    .join(" — ")
                    .trim()
        };
    }


    // ======================================
    // Company - Position
    // ======================================

    if (cleanText.includes(" - ")) {

        const parts =
            cleanText.split(" - ");

        return {

            company:
                parts[0].trim() ||
                "Unknown",

            position:
                parts
                    .slice(1)
                    .join(" - ")
                    .trim()
        };
    }


    // ======================================
    // Unknown company
    // ======================================

    return {

        company: "Unknown",

        position: cleanText
    };
}


// ==========================================
// PARSE ONE TELEGRAM CHANNEL
// ==========================================

async function parseTelegramChannel(
    page,
    channel
) {

    console.log("");
    console.log(
        `📨 Opening @${channel}...`
    );


    const url =
        `https://t.me/s/${channel}`;


    try {

        await page.goto(url, {

            waitUntil:
                "domcontentloaded",

            timeout:
                30000
        });


        await page.waitForTimeout(1500);


        const messages =
            page.locator(
                ".tgme_widget_message"
            );


        const count =
            await messages.count();


        console.log(
            `📋 @${channel}: ${count} messages found`
        );


        // ==================================
        // NO PUBLIC MESSAGES
        // ==================================

        if (count === 0) {

            console.log(
                `⚠️ @${channel}: no public messages available`
            );

            return [];
        }


        // ==================================
        // LAST N MESSAGES
        // ==================================

        const startIndex =
            Math.max(
                0,
                count -
                    MESSAGES_PER_CHANNEL
            );


        const jobs = [];


        let skippedWithoutText = 0;

        let skippedWithoutLink = 0;

        let skippedNotQa = 0;


        // ==================================
        // PROCESS MESSAGES
        // ==================================

        for (
            let i = startIndex;
            i < count;
            i++
        ) {

            const message =
                messages.nth(i);


            try {

                // ==========================
                // MESSAGE TEXT
                // ==========================

                const messageText =
                    await message
                        .locator(
                            ".tgme_widget_message_text"
                        )
                        .innerText()
                        .catch(
                            () => ""
                        );


                if (!messageText) {

                    skippedWithoutText++;

                    continue;
                }


                const text =
                    messageText
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();


                if (!text) {

                    skippedWithoutText++;

                    continue;
                }


                // ==========================
                // MESSAGE URL
                // ==========================

                const messageLink =
                    await message
                        .locator(
                            "a.tgme_widget_message_date"
                        )
                        .getAttribute(
                            "href"
                        )
                        .catch(
                            () => null
                        );


                if (!messageLink) {

                    skippedWithoutLink++;

                    continue;
                }


                // ==========================
                // COMPANY / POSITION
                // ==========================

                const parsed =
                    extractCompanyAndPosition(
                        text
                    );


                const job = {

                    company:
                        parsed.company,

                    position:
                        parsed.position,

                    description:
                        text,

                    url:
                        messageLink,

                    source:
                        `Telegram: @${channel}`
                };


                // ==========================
                // QA FILTER
                // ==========================

                if (!isQaJob(job)) {

                    skippedNotQa++;

                    continue;
                }


                jobs.push(job);


            } catch (error) {

                console.log(
                    `⚠️ @${channel}: failed to parse message ${i}`
                );
            }
        }


        // ==================================
        // CHANNEL DEDUPLICATION
        // ==================================

        const uniqueJobs = [

            ...new Map(

                jobs.map(job => [

                    job.url,

                    job

                ])

            ).values()
        ];


        console.log(
            `🎯 @${channel}: ${uniqueJobs.length} QA jobs`
        );


        console.log(
            `   ↳ skipped: ` +
            `no text=${skippedWithoutText}, ` +
            `no link=${skippedWithoutLink}, ` +
            `not QA=${skippedNotQa}`
        );


        return uniqueJobs;


    } catch (error) {

        console.error(
            `❌ @${channel} parser error:`
        );


        console.error(
            error?.message ||
            error
        );


        return [];
    }
}


// ==========================================
// MAIN TELEGRAM PARSER
// ==========================================

async function getTelegramWebJobs() {

    console.log("");

    console.log(
        "📨 Starting Telegram Web parser..."
    );


    console.log(
        `📚 Channels: ${TELEGRAM_CHANNELS.length}`
    );


    console.log(
        `📨 Target messages/channel: ${MESSAGES_PER_CHANNEL}`
    );


    const browser =
        await chromium.launch({

            headless: true

        });


    const page =
        await browser.newPage({

            viewport: {

                width: 1440,

                height: 900
            }
        });


    const allJobs = [];


    try {

        // ==================================
        // PROCESS ALL CHANNELS
        // ==================================

        for (
            const channel
            of TELEGRAM_CHANNELS
        ) {

            const jobs =
                await parseTelegramChannel(
                    page,
                    channel
                );


            allJobs.push(
                ...jobs
            );
        }


        // ==================================
        // GLOBAL DEDUPLICATION
        // ==================================

        const uniqueJobs = [

            ...new Map(

                allJobs.map(job => [

                    job.url,

                    job

                ])

            ).values()
        ];


        // ==================================
        // SUMMARY
        // ==================================

        console.log("");

        console.log(
            "================================"
        );


        console.log(
            `📦 Telegram collected: ${allJobs.length}`
        );


        console.log(
            `🧹 Telegram unique: ${uniqueJobs.length}`
        );


        console.log(
            "================================"
        );


        // ==================================
        // CHANNEL STATISTICS
        // ==================================

        console.log("");

        console.log(
            "📊 Telegram channel statistics:"
        );


        for (
            const channel
            of TELEGRAM_CHANNELS
        ) {

            const channelJobs =
                uniqueJobs.filter(
                    job =>
                        job.source ===
                        `Telegram: @${channel}`
                );


            console.log(
                `   @${channel}: ${channelJobs.length} QA jobs`
            );
        }


        return uniqueJobs;


    } catch (error) {

        console.error(
            "❌ Telegram Web parser error:"
        );


        console.error(
            error?.message ||
            error
        );


        return [];


    } finally {

        await browser.close();
    }
}


// ==========================================
// EXPORT
// ==========================================

module.exports = {

    getTelegramWebJobs

};