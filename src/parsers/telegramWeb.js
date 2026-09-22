const { launchPage } = require("../core/browser");
const { createLogger } = require("../core/logger");
const { dedupeByUrl } = require("../core/dedupe");
const { withRetry } = require("../core/retry");
const { matchesQa } = require("../utils/qaFilter");

/*
 * Public Telegram channels (t.me/s/<username> web preview), scraped
 * with Playwright since there's no API access here. Only the
 * usernames below were manually confirmed live (fetched each
 * t.me/s/<username> and checked it's a real channel with actual
 * posted messages, not an empty contact-card page) -- 11 previously
 * listed channels turned out to be guessed usernames that don't
 * exist and were removed (see git history, 2026-09-04).
 */
const TELEGRAM_CHANNELS = [
    "qa_jobs",
    "qajobsru",
    "qa_chillout_jobs",
    "wantapply_qa_jobs",
    "youritjob",
    "jobforjunior",
    "qa_rab",
    "qa_vacancies",
    "qa_job",
    "qa_work",
    "remote_jobs_ru",
    "remoteit"
];

// Supabase dedupes against already-known vacancies on every run, so
// re-reading the last 200 messages per channel each time is fine.
const MESSAGES_PER_CHANNEL = 200;

// t.me/s/<channel> only renders ~20 latest messages until scrolled
// up, which lazy-loads older history via XHR.
const MAX_SCROLL_ATTEMPTS = 12;

function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

/*
 * Telegram job posts are typically "Company / Position" or
 * "Company — Position" or "Company - Position"; falls back to
 * treating the whole line as the position when no separator matches.
 */
function extractCompanyAndPosition(text) {
    const clean = cleanText(text);

    if (!clean) {
        return { company: "Unknown", position: "Unknown" };
    }

    for (const separator of [" / ", " — ", " - "]) {
        if (clean.includes(separator)) {
            const parts = clean.split(separator);

            return {
                company: parts[0].trim() || "Unknown",
                position: parts.slice(1).join(separator).trim()
            };
        }
    }

    return { company: "Unknown", position: clean };
}

async function parseTelegramChannel(page, channel, logger) {
    logger.info(`opening @${channel}...`);

    const url = `https://t.me/s/${channel}`;

    try {
        await withRetry(
            () => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }),
            { attempts: 2, baseDelayMs: 1000, label: `@${channel} goto`, logger }
        );

        await page.waitForTimeout(1500);

        const messages = page.locator(".tgme_widget_message");

        let previousCount = await messages.count();

        for (
            let scrollAttempt = 0;
            scrollAttempt < MAX_SCROLL_ATTEMPTS && previousCount < MESSAGES_PER_CHANNEL;
            scrollAttempt++
        ) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(800);

            const newCount = await messages.count();

            if (newCount <= previousCount) {
                break;
            }

            previousCount = newCount;
        }

        const count = await messages.count();

        logger.info(`@${channel}: ${count} messages found`);

        if (count === 0) {
            logger.warn(`@${channel}: no public messages available`);
            return [];
        }

        const startIndex = Math.max(0, count - MESSAGES_PER_CHANNEL);
        const jobs = [];

        let skippedWithoutText = 0;
        let skippedWithoutLink = 0;
        let skippedNotQa = 0;

        for (let i = startIndex; i < count; i++) {
            const message = messages.nth(i);

            try {
                const messageText = await message
                    .locator(".tgme_widget_message_text")
                    .innerText()
                    .catch(() => "");

                const text = cleanText(messageText);

                if (!text) {
                    skippedWithoutText++;
                    continue;
                }

                const messageLink = await message
                    .locator("a.tgme_widget_message_date")
                    .getAttribute("href")
                    .catch(() => null);

                if (!messageLink) {
                    skippedWithoutLink++;
                    continue;
                }

                const { company, position } = extractCompanyAndPosition(text);

                const job = {
                    company,
                    position,
                    description: text,
                    url: messageLink,
                    source: `Telegram: @${channel}`
                };

                // Telegram posts are unstructured enough that
                // checking position+description together (via
                // matchesQa) catches real postings that the
                // "Company / Position" heuristic above mis-split.
                if (!matchesQa(`${position} ${text}`)) {
                    skippedNotQa++;
                    continue;
                }

                jobs.push(job);
            } catch (error) {
                logger.warn(`@${channel}: failed to parse message ${i}: ${error?.message || error}`);
            }
        }

        const uniqueJobs = dedupeByUrl(jobs);

        logger.info(`@${channel}: ${uniqueJobs.length} QA jobs`);
        logger.info(
            `  skipped: no text=${skippedWithoutText}, no link=${skippedWithoutLink}, not QA=${skippedNotQa}`
        );

        return uniqueJobs;
    } catch (error) {
        logger.error(`@${channel} parser error: ${error?.message || error}`);
        return [];
    }
}

async function getTelegramWebJobs() {
    const logger = createLogger("Telegram");

    logger.info(`starting -- channels: ${TELEGRAM_CHANNELS.length}, target messages/channel: ${MESSAGES_PER_CHANNEL}`);

    const { browser, page } = await launchPage({ viewport: { width: 1440, height: 900 } });

    const allJobs = [];

    try {
        for (const channel of TELEGRAM_CHANNELS) {
            const jobs = await parseTelegramChannel(page, channel, logger);
            allJobs.push(...jobs);
        }

        const uniqueJobs = dedupeByUrl(allJobs);

        logger.info(`collected: ${allJobs.length}, unique: ${uniqueJobs.length}`);
        logger.info("channel statistics:");

        for (const channel of TELEGRAM_CHANNELS) {
            const channelJobs = uniqueJobs.filter(job => job.source === `Telegram: @${channel}`);
            logger.info(`  @${channel}: ${channelJobs.length} QA jobs`);
        }

        return uniqueJobs;
    } catch (error) {
        logger.error(`parser error: ${error?.message || error}`);
        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    getTelegramWebJobs
};
