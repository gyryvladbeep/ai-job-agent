const test = require("node:test");
const assert = require("node:assert/strict");

const { hasRelocationSignal } = require("../src/utils/relocationTag");

test("hasRelocationSignal: detects English relocation/visa phrases", () => {
    assert.equal(hasRelocationSignal({ position: "QA Engineer", description: "visa sponsorship available" }), true);
});

test("hasRelocationSignal: detects Russian relocation phrases, including inflected forms", () => {
    assert.equal(hasRelocationSignal({ position: "Тестировщик", description: "предоставляем визовую поддержку" }), true);
    assert.equal(hasRelocationSignal({ position: "QA", description: "поможем с релокацией в другую страну" }), true);
    assert.equal(hasRelocationSignal({ position: "QA", description: "оплачиваем переезд сотрудника" }), true);
});

test("hasRelocationSignal: false when no signal present", () => {
    assert.equal(hasRelocationSignal({ position: "QA Engineer", description: "remote, competitive salary" }), false);
});

test("hasRelocationSignal: handles missing fields", () => {
    assert.equal(hasRelocationSignal({}), false);
});
