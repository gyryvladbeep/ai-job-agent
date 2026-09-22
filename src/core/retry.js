/*
 * Generic retry-with-backoff for a flaky network operation (a
 * page.goto(), a fetch()). None of the previous parsers retried
 * anything -- a single dropped connection or a transient 502 killed
 * that whole source for the run, indistinguishable in the logs from
 * the site actually being down. Retrying a couple of times with a
 * short linear backoff absorbs that class of noise without masking
 * a genuinely broken source (it still throws after the last attempt).
 */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, options = {}) {
    const {
        attempts = 3,
        baseDelayMs = 1000,
        label = "operation",
        logger = null
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (error) {
            lastError = error;

            if (logger) {
                logger.warn(
                    `${label} failed (attempt ${attempt}/${attempts}): ` +
                    (error?.message || error)
                );
            }

            if (attempt < attempts) {
                await sleep(baseDelayMs * attempt);
            }
        }
    }

    throw lastError;
}

module.exports = {
    withRetry,
    sleep
};
