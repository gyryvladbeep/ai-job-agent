/*
 * Several sources don't expose a single stable row selector -- the
 * site's markup has changed under a previous session before, or the
 * exact class names were never fully confirmed. Trying an ordered
 * list of candidate selectors and using the first one that matches
 * anything was already duplicated (with slightly different code
 * each time) in Ministry of Testing and Working Nomads. One version
 * now, usable by any source that needs it.
 */

async function resolveRows(page, rowSelector) {
    const candidates = Array.isArray(rowSelector)
        ? rowSelector
        : [rowSelector];

    for (const selector of candidates) {
        const locator = page.locator(selector);
        const count = await locator.count();

        if (count > 0) {
            return { locator, selector, count };
        }
    }

    return { locator: null, selector: null, count: 0 };
}

/*
 * Within a single row/card, several sources try an ordered list of
 * candidate selectors for one field (title, company, description)
 * and use the first one with non-empty text -- Remote OK, Working
 * Nomads and Ministry of Testing all had their own copy of this
 * exact loop.
 */
async function firstMatchingText(row, selectors, cleanText) {
    for (const selector of selectors) {
        const locator = row.locator(selector).first();

        if (await locator.count()) {
            const text = await locator.innerText().catch(() => "");

            if (text && text.trim()) {
                return cleanText(text);
            }
        }
    }

    return "";
}

module.exports = {
    resolveRows,
    firstMatchingText
};
