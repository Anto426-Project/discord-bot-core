import {} from "./HumanReadableOperationalLogFormatter.js";
import { LegacyConsoleOperationalLogFormatter } from "./LegacyConsoleOperationalLogFormatter.js";
const severityRank = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50
});
const SINK_FAILURE_REPEAT_WINDOW_MS = 30_000;
const defaultWriter = (line, severity) => {
    const spacedLine = `${line}\n`;
    if (severity === "error" || severity === "fatal") {
        console.error(spacedLine);
        return;
    }
    if (severity === "warn") {
        console.warn(spacedLine);
        return;
    }
    console.log(spacedLine);
};
const createDefaultFormatter = () => new LegacyConsoleOperationalLogFormatter({
    isTty: process.stdout?.isTTY === true,
    colors: process.stdout?.hasColors?.() ?? process.stdout?.isTTY === true,
    compact: true,
    columns: process.stdout?.columns
});
export class ConsoleOperationalLogSink {
    minimumSeverity;
    writer;
    formatter;
    key = "console";
    kind = "collector";
    sinkFailureReportedAt = new Map();
    constructor(minimumSeverity = "info", writer = defaultWriter, formatter = createDefaultFormatter()) {
        this.minimumSeverity = minimumSeverity;
        this.writer = writer;
        this.formatter = formatter;
    }
    async write(record) {
        if (severityRank[record.severity] < severityRank[this.minimumSeverity]) {
            return;
        }
        this.writer(this.formatter.format(record), record.severity);
    }
    reportSinkFailure(failure, record) {
        try {
            const now = Date.now();
            const previous = this.sinkFailureReportedAt.get(failure.sinkKey);
            if (previous !== undefined &&
                now - previous < SINK_FAILURE_REPEAT_WINDOW_MS) {
                return;
            }
            this.sinkFailureReportedAt.set(failure.sinkKey, now);
            this.writer(this.formatter.formatSinkFailure(failure, record, new Date(now)), "error");
        }
        catch {
            // Terminal fallback: never recurse and never affect the caller.
        }
    }
}
//# sourceMappingURL=ConsoleOperationalLogSink.js.map