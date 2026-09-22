/*
 * Every source and the pipeline itself deduplicate jobs by URL --
 * previously this exact same six-line Map/values() snippet was
 * copy-pasted into every single parser file plus src/index.js.
 * One implementation now, so a future change to the dedupe key
 * (say, normalizing trailing slashes or query params) only needs
 * to happen in one place.
 */

function dedupeByUrl(jobs) {
    const seen = new Map();

    for (const job of jobs || []) {
        if (!job || !job.url) {
            continue;
        }

        // First occurrence wins -- Map.set on an existing key would
        // silently overwrite it with the later duplicate's data
        // instead (the exact pattern every parser used to copy-paste
        // before this was unified), which is surprising and was
        // never a deliberate choice anywhere in the codebase.
        if (!seen.has(job.url)) {
            seen.set(job.url, job);
        }
    }

    return [...seen.values()];
}

module.exports = {
    dedupeByUrl
};
