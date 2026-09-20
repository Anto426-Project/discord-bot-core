import { type OperationalLogRecord, type OperationalLogSinkFailure } from "./OperationalLogTypes.js";
import type { ConsoleOperationalLogFormatter } from "./HumanReadableOperationalLogFormatter.js";
export type LegacyConsoleOperationalLogFormatterOptions = Readonly<{
    isTty?: boolean;
    colors?: boolean;
    compact?: boolean;
    columns?: number;
}>;
/**
 * Terminal projection inspired by the previous BotConsole presentation.
 * It is deliberately presentation-only: the canonical structured record is
 * still handed unchanged to an independent persistent sink.
 */
export declare class LegacyConsoleOperationalLogFormatter implements ConsoleOperationalLogFormatter {
    private readonly isTty;
    private readonly useColors;
    private readonly compact;
    private readonly columns;
    constructor(options?: LegacyConsoleOperationalLogFormatterOptions);
    format(record: OperationalLogRecord): string;
    formatSinkFailure(failure: OperationalLogSinkFailure, sourceRecord: OperationalLogRecord, occurredAt: Date): string;
    private renderCompact;
    private renderExpanded;
    private paint;
}
//# sourceMappingURL=LegacyConsoleOperationalLogFormatter.d.ts.map