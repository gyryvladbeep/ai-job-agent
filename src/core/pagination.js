/*
 * Pluggable "go to page N" strategies for runListScraper (see
 * listScraper.js). Every homogeneous list-page source used to
 * hand-roll its own version of one of these three patterns; now
 * there is exactly one implementation of each.
 */

/*
 * Pages reached by building a URL (?page=N, /vacancies?page=N, ...).
 * Used by GeekJob, Wellfound, Habr Career.
 */
function urlParamPager(buildUrl) {
    return async function goToPage(page, pageNum, entryPoint) {
        const url = buildUrl(pageNum, entryPoint);

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        return true;
    };
}

/*
 * Pages reached by clicking a "next page" control in the DOM, for
 * sites that don't expose (or don't reliably document) a URL
 * parameter for pagination. Used by Talanto -- its pagination URL
 * scheme is unconfirmed, but a real "next page" control exists in
 * the DOM, so clicking it is more reliable than guessing a param.
 *
 * pageNum === 1 is assumed to already be loaded by the caller (the
 * initial page.goto), so this only fires the click for pageNum > 1.
 */
function clickNextPager(candidateSelectors) {
    return async function goToPage(page, pageNum) {
        if (pageNum === 1) {
            return true;
        }

        for (const selector of candidateSelectors) {
            const candidate = page.locator(selector).first();

            if (!(await candidate.count())) {
                continue;
            }

            const isDisabled = await candidate
                .getAttribute("aria-disabled")
                .catch(() => null);

            if (isDisabled === "true") {
                continue;
            }

            try {
                await candidate.click({ timeout: 5000 });
                return true;
            } catch (error) {
                continue;
            }
        }

        return false;
    };
}

/*
 * Scrolls the current page to the bottom repeatedly until the
 * matched row count stops growing (or maxAttempts is hit). Used by
 * sources that lazy-load additional rows on scroll instead of
 * exposing real pagination (Remote OK, Working Nomads) -- and, with
 * maxAttempts=0, this is also how a genuinely single-page source
 * (Ministry of Testing, ITA Jobs) is expressed: "scroll zero times."
 */
async function scrollUntilStable(page, { rowSelector, maxAttempts = 20, waitMs = 1000, logger = null } = {}) {
    const locator = page.locator(rowSelector);
    let previousCount = await locator.count();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });

        await page.waitForTimeout(waitMs);

        const newCount = await locator.count();

        if (newCount <= previousCount) {
            if (logger) {
                logger.info(
                    `scroll stopped growing at ${newCount} rows (attempt ${attempt + 1})`
                );
            }
            break;
        }

        previousCount = newCount;
    }

    return await locator.count();
}

module.exports = {
    urlParamPager,
    clickNextPager,
    scrollUntilStable
};
