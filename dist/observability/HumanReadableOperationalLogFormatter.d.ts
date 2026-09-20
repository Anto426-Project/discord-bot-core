import { type OperationalLogRecord, type OperationalLogSinkFailure } from "./OperationalLogTypes.js";
export interface ConsoleOperationalLogFormatter {
    format(record: OperationalLogRecord): string;
    formatSinkFailure(failure: OperationalLogSinkFailure, sourceRecord: OperationalLogRecord, occurredAt: Date): string;
}
export declare class HumanReadableOperationalLogFormatter implements ConsoleOperationalLogFormatter {
    format(record: OperationalLogRecord): string;
    formatSinkFailure(failure: OperationalLogSinkFailure, sourceRecord: OperationalLogRecord, occurredAt: Date): string;
}
//# sourceMappingURL=HumanReadableOperationalLogFormatter.d.ts.map