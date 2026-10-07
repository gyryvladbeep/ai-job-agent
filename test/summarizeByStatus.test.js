const test = require("node:test");
const assert = require("node:assert/strict");

const { summarizeByStatus } = require("../src/core/summarizeByStatus");

test("summarizeByStatus: counts vacancies per status", () => {
    const jobs = [
        { status: "new" },
        { status: "new" },
        { status: "applied" },
        { status: "notified" }
    ];

    assert.deepEqual(summarizeByStatus(jobs), { new: 2, applied: 1, notified: 1 });
});

test("summarizeByStatus: empty or missing input gives an empty object", () => {
    assert.deepEqual(summarizeByStatus([]), {});
    assert.deepEqual(summarizeByStatus(undefined), {});
});

test("summarizeByStatus: skips malformed entries without a string status", () => {
    assert.deepEqual(summarizeByStatus([null, {}, { status: "new" }]), { new: 1 });
});
