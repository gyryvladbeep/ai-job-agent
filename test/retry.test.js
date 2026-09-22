const test = require("node:test");
const assert = require("node:assert/strict");

const { withRetry } = require("../src/core/retry");

test("withRetry: returns the result on first success", async () => {
    let calls = 0;

    const result = await withRetry(async () => {
        calls++;
        return "ok";
    }, { attempts: 3, baseDelayMs: 1 });

    assert.equal(result, "ok");
    assert.equal(calls, 1);
});

test("withRetry: retries after a failure and eventually succeeds", async () => {
    let calls = 0;

    const result = await withRetry(async (attempt) => {
        calls++;
        if (attempt < 2) {
            throw new Error("transient");
        }
        return "recovered";
    }, { attempts: 3, baseDelayMs: 1 });

    assert.equal(result, "recovered");
    assert.equal(calls, 2);
});

test("withRetry: throws the last error after exhausting all attempts", async () => {
    let calls = 0;

    await assert.rejects(
        () => withRetry(async () => {
            calls++;
            throw new Error("always fails");
        }, { attempts: 3, baseDelayMs: 1 }),
        /always fails/
    );

    assert.equal(calls, 3);
});
