const { chromium } = require("playwright");

/*
 * One place for the browser fingerprint every Playwright-based
 * source should use. GeekJob's 2+ weeks of zero results (see
 * README changelog, 2026-09-22) traced back to it being the only
 * parser launching newPage() with no User-Agent/viewport at all --
 * a bare headless-Chrome fingerprint is exactly what a site's
 * anti-bot layer looks for. Every source now gets the same
 * realistic desktop Chrome signature unless it explicitly opts out.
 */
const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/151.0.0.0 Safari/537.36";

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/*
 * Launches a browser + page pair with the standard fingerprint.
 * Returns both so callers can close the browser in their own
 * try/finally -- this module never owns the lifecycle.
 */
async function launchPage(options = {}) {
    const browser = await chromium.launch({
        headless: options.headless !== false,
        slowMo: options.slowMo || 0
    });

    const page = await browser.newPage({
        viewport: options.viewport || DEFAULT_VIEWPORT,
        userAgent: options.userAgent || DEFAULT_USER_AGENT
    });

    return { browser, page };
}

module.exports = {
    launchPage,
    DEFAULT_USER_AGENT,
    DEFAULT_VIEWPORT
};
