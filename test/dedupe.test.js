const test = require("node:test");
const assert = require("node:assert/strict");

const { dedupeByUrl } = require("../src/core/dedupe");

test("dedupeByUrl: removes exact URL duplicates, keeps first occurrence", () => {
    const jobs = [
        { url: "https://a.example/1", position: "first" },
        { url: "https://a.example/2", position: "second" },
        { url: "https://a.example/1", position: "duplicate, should be dropped" }
    ];

    const result = dedupeByUrl(jobs);

    assert.equal(result.length, 2);
    assert.equal(result[0].position, "first");
});

test("dedupeByUrl: drops entries with no url", () => {
    const jobs = [
        { url: "https://a.example/1" },
        { position: "no url" },
        { url: null, position: "null url" }
    ];

    const result = dedupeByUrl(jobs);

    assert.equal(result.length, 1);
});

test("dedupeByUrl: handles empty/undefined input", () => {
    assert.deepEqual(dedupeByUrl([]), []);
    assert.deepEqual(dedupeByUrl(undefined), []);
});
