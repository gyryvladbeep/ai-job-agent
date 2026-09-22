/*
 * Structured, source-prefixed logging used across the whole pipeline.
 * Deliberately plain text, no emojis (project convention) -- every
 * line is grep-able and reads the same in a terminal, a log file, or
 * a Windows Task Scheduler history view.
 */

function createLogger(sourceName) {
    const prefix = `[${sourceName}]`;

    return {
        info(...args) {
            console.log(prefix, ...args);
        },

        warn(...args) {
            console.warn(prefix, "WARN:", ...args);
        },

        error(...args) {
            console.error(prefix, "ERROR:", ...args);
        },

        table(rows) {
            console.table(rows);
        }
    };
}

module.exports = {
    createLogger
};
