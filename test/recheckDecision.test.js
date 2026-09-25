const test = require("node:test");
const assert = require("node:assert/strict");

const { decideAction } = require("../src/core/recheckDecision");

test("decideAction: resend when the vacancy is still live", () => {
    assert.equal(decideAction(true), "resend");
});

test("decideAction: delete when the vacancy is no longer live", () => {
    assert.equal(decideAction(false), "delete");
});
