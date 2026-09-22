/*
 * Static sanity check for the source registry -- validates shape
 * (name is a non-empty string, parser is a function, no duplicate
 * names) without launching a single browser or making a network
 * call. Meant to run in a few hundred milliseconds as a fast
 * pre-flight before a real `npm start`, e.g. right after adding a
 * new source to src/config/sources.js.
 */

const { SOURCES } = require("./config/sources");

function checkSources() {
    const errors = [];
    const seenNames = new Set();

    if (!Array.isArray(SOURCES) || SOURCES.length === 0) {
        errors.push("SOURCES is empty or not an array");
    }

    for (const entry of SOURCES || []) {
        if (!entry || typeof entry !== "object") {
            errors.push(`invalid entry: ${JSON.stringify(entry)}`);
            continue;
        }

        const { name, parser } = entry;

        if (typeof name !== "string" || !name.trim()) {
            errors.push(`entry missing a valid "name": ${JSON.stringify(entry)}`);
        } else if (seenNames.has(name)) {
            errors.push(`duplicate source name: "${name}"`);
        } else {
            seenNames.add(name);
        }

        if (typeof parser !== "function") {
            errors.push(`source "${name}" has no parser function`);
        }
    }

    if (errors.length > 0) {
        console.error("[checkSources] FAILED:");
        for (const error of errors) {
            console.error(`  - ${error}`);
        }
        process.exitCode = 1;
        return false;
    }

    console.log(`[checkSources] OK -- ${SOURCES.length} sources registered:`);
    for (const { name } of SOURCES) {
        console.log(`  - ${name}`);
    }

    return true;
}

if (require.main === module) {
    checkSources();
}

module.exports = {
    checkSources
};
