import type { OperationalLogFallback, OperationalLogRecord, OperationalLogSeverity, OperationalLogSink, OperationalLogSinkFailure } from "./OperationalLogTypes.js";
import { type ConsoleOperationalLogFormatter } from "./HumanReadableOperationalLogFormatter.js";
export type ConsoleLogWriter = (line: string, severity: OperationalLogSeverity) => void;
export declare class ConsoleOperationalLogSink implements OperationalLogSink, OperationalLogFallback {
    private readonly minimumSeverity;
    private readonly writer;
    private readonly formatter;
    readonly key = "console";
    readonly kind: "collector";
    private readonly sinkFailureReportedAt;
    constructor(minimumSeverity?: OperationalLogSeverity, writer?: ConsoleLogWriter, formatter?: ConsoleOperationalLogFormatter);
    write(record: OperationalLogRecord): Promise<void>;
    reportSinkFailure(failure: OperationalLogSinkFailure, record: OperationalLogRecord): void;
}
//# sourceMappingURL=ConsoleOperationalLogSink.d.ts.map