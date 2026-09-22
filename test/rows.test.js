const test = require("node:test");
const assert = require("node:assert/strict");

const { firstMatchingText } = require("../src/core/rows");

/*
 * Minimal fake Playwright locator -- just enough of the API surface
 * (count/innerText/locator/first) for firstMatchingText's candidate-
 * selector fallback loop to run against, without a real browser.
 */
function fakeLocator(selectorToText) {
    return {
        locator(selector) {
            return {
                first() {
                    return {
                        async count() {
                            return selectorToText[selector] ? 1 : 0;
                        },
                        async innerText() {
                            return selectorToText[selector] || "";
                        }
                    };
                }
            };
        }
    };
}

function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

test("firstMatchingText: returns the first candidate selector with non-empty text", async () => {
    const row = fakeLocator({ ".title": "", "h2": "  QA Engineer  " });

    const result = await firstMatchingText(row, [".title", "h2", "h3"], cleanText);

    assert.equal(result, "QA Engineer");
});

test("firstMatchingText: returns empty string when nothing matches", async () => {
    const row = fakeLocator({});

    const result = await firstMatchingText(row, [".title", "h2"], cleanText);

    assert.equal(result, "");
});
