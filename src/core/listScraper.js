const { launchPage } = require("./browser");
const { createLogger } = require("./logger");
const { dumpDebugArtifacts } = require("./debugDump");
const { dedupeByUrl } = require("./dedupe");
const { resolveRows } = require("./rows");
const { scrollUntilStable } = require("./pagination");

/*
 * Generic orchestrator for the "list of cards, one job per card"
 * shape that GeekJob, Wellfound, Remote OK, Working Nomads, Talanto,
 * Habr Career, Ministry of Testing and ITA Jobs all share -- despite
 * each site's markup being different, the control flow around it
 * (launch a page, load an entry point, page/scroll through results,
 * extract each row, dedupe, dump debug artifacts on failure, log a
 * summary) was previously duplicated nearly verbatim across all 8
 * files. This is that control flow, written once; each source now
 * supplies only what's genuinely unique to it: its URL(s), its row
 * selector(s), and a small extractJob() function.
 *
 * config shape:
 *   name            display name used in logs and as job.source
 *   slug            short id used for debug-artifact filenames
 *   entryPoints     [{ id, initialUrl, buildPageUrl? }] -- almost
 *                   always one entry point; Habr Career uses two
 *                   (its two vacancy categories), each paginated
 *                   and deduped independently.
 *   rowSelector     a CSS selector, or an array of candidate
 *                   selectors tried in order (first match wins)
 *   pagination      { kind: "paged", maxPages, advance }
 *                   or { kind: "scroll", maxAttempts, waitMs }
 *                   (maxAttempts: 0 degenerates into "single page")
 *   waitAfterLoadMs how long to wait after each navigation for the
 *                   page to hydrate (default 2000)
 *   extractJob      async ({ row, page, cleanText, entryPoint, logger,
 *                   index }) => { position, url, company?,
 *                   description? } | null -- returning null (or a
 *                   falsy url/position) skips the row entirely,
 *                   before it's even considered for dedup/pagination
 *                   bookkeeping (used by Talanto to skip premium
 *                   cards without them counting as "new" rows).
 *   filterLocally   optional (job) => boolean, applied per row
 *                   before it's added to the result (used where a
 *                   source benefits from filtering during
 *                   extraction, e.g. Habr Career's two categories);
 *                   pagination "did this page have anything new"
 *                   is always based on raw new URLs seen, not on
 *                   this filter, so a page of non-QA postings never
 *                   looks like "end of results" and stops early.
 *   browserOptions  optional overrides passed to launchPage()
 *   beforeAll       optional async (page, logger) => void, run once
 *                   right after the browser/page are ready and
 *                   before any entry point loads -- e.g. GeekJob
 *                   warms up on the homepage first before hitting
 *                   the vacancies list, matching its original
 *                   behavior.
 */
function cleanText(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

async function extractRow({ row, page, entryPoint, extractJob, logger, index }) {
    try {
        const job = await extractJob({ row, page, cleanText, entryPoint, logger, index });

        if (!job || !job.url || !job.position) {
            return null;
        }

        return {
            company: job.company || "Unknown",
            position: job.position,
            description: job.description || "",
            url: job.url
        };
    } catch (error) {
        logger.warn(`row ${index} parse failed: ${error?.message || error}`);
        return null;
    }
}

async function runPagedEntryPoint({ page, entryPoint, config, logger, allJobs }) {
    const { rowSelector, pagination, extractJob, filterLocally, waitAfterLoadMs, slug } = config;
    const maxPages = pagination.maxPages || 1;
    const seenUrls = new Set();

    await page.goto(entryPoint.initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
    });

    await page.waitForTimeout(waitAfterLoadMs || 2000);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        if (pageNum > 1) {
            const advanced = await pagination.advance(page, pageNum, entryPoint);

            if (!advanced) {
                logger.info(`no next page after page ${pageNum - 1}, stopping "${entryPoint.id}"`);
                break;
            }

            await page.waitForTimeout(waitAfterLoadMs || 2000);
        }

        const { locator, count } = await resolveRows(page, rowSelector);

        logger.info(`entry "${entryPoint.id}" page ${pageNum}: ${count} rows found`);

        if (count === 0) {
            if (pageNum === 1) {
                await dumpDebugArtifacts(page, slug, `${entryPoint.id}-empty`, logger);
            }
            break;
        }

        let newOnThisPage = 0;

        for (let i = 0; i < count; i++) {
            const job = await extractRow({
                row: locator.nth(i),
                page,
                entryPoint,
                extractJob,
                logger,
                index: i
            });

            if (!job) {
                continue;
            }

            if (seenUrls.has(job.url)) {
                continue;
            }

            seenUrls.add(job.url);
            newOnThisPage++;

            if (filterLocally && !filterLocally(job)) {
                continue;
            }

            allJobs.push({ ...job, source: config.name });
        }

        if (newOnThisPage === 0) {
            logger.info(`no new rows on page ${pageNum}, stopping "${entryPoint.id}"`);
            break;
        }
    }
}

async function runScrollEntryPoint({ page, entryPoint, config, logger, allJobs }) {
    const { rowSelector, pagination, extractJob, filterLocally, waitAfterLoadMs, slug } = config;

    await page.goto(entryPoint.initialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
    });

    await page.waitForTimeout(waitAfterLoadMs || 2000);

    const initial = await resolveRows(page, rowSelector);

    if (initial.count === 0) {
        logger.warn(`0 rows found for "${entryPoint.id}"`);
        await dumpDebugArtifacts(page, slug, `${entryPoint.id}-empty`, logger);
        return;
    }

    await scrollUntilStable(page, {
        rowSelector: initial.selector,
        maxAttempts: pagination.maxAttempts || 0,
        waitMs: pagination.waitMs || 1000,
        logger
    });

    const final = await resolveRows(page, initial.selector);

    logger.info(`entry "${entryPoint.id}": ${final.count} rows after scroll`);

    const seenUrls = new Set();
    let extracted = 0;

    for (let i = 0; i < final.count; i++) {
        const job = await extractRow({
            row: final.locator.nth(i),
            page,
            entryPoint,
            extractJob,
            logger,
            index: i
        });

        if (!job || seenUrls.has(job.url)) {
            continue;
        }

        seenUrls.add(job.url);
        extracted++;

        if (filterLocally && !filterLocally(job)) {
            continue;
        }

        allJobs.push({ ...job, source: config.name });
    }

    if (extracted === 0 && final.count > 0) {
        logger.warn(`rows were found for "${entryPoint.id}" but none produced a valid job -- dumping for inspection`);
        await dumpDebugArtifacts(page, slug, `${entryPoint.id}-empty-extract`, logger);
    }
}

async function runListScraper(config) {
    const logger = createLogger(config.name);
    const allJobs = [];

    logger.info("opening source...");

    const { browser, page } = await launchPage(config.browserOptions || {});

    try {
        if (config.beforeAll) {
            try {
                await config.beforeAll(page, logger);
            } catch (warmupError) {
                logger.warn(`beforeAll hook failed (continuing): ${warmupError?.message || warmupError}`);
            }
        }

        for (const entryPoint of config.entryPoints) {
            if (config.pagination.kind === "paged") {
                await runPagedEntryPoint({ page, entryPoint, config, logger, allJobs });
            } else {
                await runScrollEntryPoint({ page, entryPoint, config, logger, allJobs });
            }
        }

        const uniqueJobs = dedupeByUrl(allJobs);

        logger.info(`collected: ${uniqueJobs.length}`);
        logger.table(uniqueJobs);

        return uniqueJobs;
    } catch (error) {
        logger.error(`parser error: ${error?.message || error}`);

        await dumpDebugArtifacts(page, config.slug, "error", logger).catch(() => {});

        return [];
    } finally {
        await browser.close();
    }
}

module.exports = {
    runListScraper,
    cleanText
};
