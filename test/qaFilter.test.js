const test = require("node:test");
const assert = require("node:assert/strict");

const { isQaJob, matchesQa, filterQaJobs } = require("../src/utils/qaFilter");

test("isQaJob: matches an English QA title", () => {
    assert.equal(isQaJob({ position: "Senior QA Engineer" }), true);
});

test("isQaJob: matches a Russian QA title", () => {
    assert.equal(isQaJob({ position: "Инженер по тестированию" }), true);
});

test("isQaJob: matches keywords added in the 2026-09-22 sync (Quality Engineer, Quality Assurance Analyst)", () => {
    assert.equal(isQaJob({ position: "Quality Engineer" }), true);
    assert.equal(isQaJob({ position: "Quality Assurance Analyst" }), true);
});

test("isQaJob: rejects a developer title even if it says QA somewhere", () => {
    assert.equal(isQaJob({ position: "Backend Developer (QA tools team)" }), false);
});

test("isQaJob: rejects unrelated roles", () => {
    assert.equal(isQaJob({ position: "Product Manager" }), false);
    assert.equal(isQaJob({ position: "" }), false);
    assert.equal(isQaJob({ position: null }), false);
});

test("matchesQa: checks description text too (used by the Telegram parser)", () => {
    assert.equal(matchesQa("Acme Corp QA Engineer, remote, relocation support"), true);
    assert.equal(matchesQa("Acme Corp Recruiter, remote"), false);
});

test("filterQaJobs: keeps only QA jobs and preserves order", () => {
    const jobs = [
        { position: "QA Engineer" },
        { position: "Product Manager" },
        { position: "Manual Tester" }
    ];

    const result = filterQaJobs(jobs);

    assert.deepEqual(result.map(j => j.position), ["QA Engineer", "Manual Tester"]);
});
