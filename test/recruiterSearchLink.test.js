const test = require("node:test");
const assert = require("node:assert/strict");

const { buildRecruiterSearchLink } = require("../src/utils/recruiterSearchLink");

test("buildRecruiterSearchLink: builds a LinkedIn people-search URL for a real company", () => {
    const link = buildRecruiterSearchLink("Acme Corp");

    assert.ok(link.startsWith("https://www.linkedin.com/search/results/people/?keywords="));
    assert.ok(link.includes(encodeURIComponent("Acme Corp QA recruiter")));
});

test("buildRecruiterSearchLink: returns null for Unknown/empty company", () => {
    assert.equal(buildRecruiterSearchLink("Unknown"), null);
    assert.equal(buildRecruiterSearchLink(""), null);
    assert.equal(buildRecruiterSearchLink(null), null);
});
