const fs = require("fs");
const path = require("path");

/*
 * Every parser used to hand-roll its own "save a screenshot + HTML
 * dump when something looks wrong" block, scattered across the repo
 * root as <source>-debug.png / <source>-error.html. Two concrete
 * bugs came directly from that duplication:
 *
 *   - GeekJob's catch block around page.goto() only logged a
 *     warning and broke the loop -- it never reached its own
 *     count===0 dump branch, so 2+ weeks of failures left zero
 *     diagnostic artifacts (see README changelog, 2026-09-22).
 *   - Every other parser had a slightly different dump path/naming
 *     scheme, making them tedious to find after the fact.
 *
 * One function now, called from every failure path (goto errors,
 * zero rows found, rows found but nothing extracted), writing into
 * logs/debug/ (already covered by .gitignore's `logs/` rule) with a
 * consistent <source>-<reason>-<timestamp> naming scheme.
 */

const DEBUG_DIR = path.join(__dirname, "..", "..", "logs", "debug");

async function dumpDebugArtifacts(page, sourceSlug, reason, logger) {
    try {
        if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, { recursive: true });
        }

        const stamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        const base = `${sourceSlug}-${reason}-${stamp}`;

        await page.screenshot({
            path: path.join(DEBUG_DIR, `${base}.png`),
            fullPage: true
        });

        const html = await page.content();

        fs.writeFileSync(
            path.join(DEBUG_DIR, `${base}.html`),
            html,
            "utf-8"
        );

        if (logger) {
            logger.warn(`debug artifacts saved: logs/debug/${base}.png (+.html)`);
        }
    } catch (dumpError) {
        if (logger) {
            logger.warn(
                `could not save debug artifacts: ${dumpError?.message || dumpError}`
            );
        }
    }
}

module.exports = {
    dumpDebugArtifacts,
    DEBUG_DIR
};
