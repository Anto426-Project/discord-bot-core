type Clock = Readonly<{
    now(): Date;
}>;
import type { ErrorOperationalLogInput, MilestoneOperationalLogInput, OperationalErrorFingerprintPort, OperationalLogFallback, OperationalLogSink, OperationalLogWriteResult, OperationalMilestoneCatalogEntry, TransientOperationalLogInput } from "./OperationalLogTypes.js";
export type OperationalLoggerOptions = Readonly<{
    catalog: readonly OperationalMilestoneCatalogEntry[];
    clock: Clock;
    fingerprint: OperationalErrorFingerprintPort;
    sinks: readonly OperationalLogSink[];
    fallback?: OperationalLogFallback;
}>;
export declare class OperationalLogger {
    private readonly options;
    private readonly catalog;
    private readonly collectorSinks;
    private readonly persistentSinks;
    constructor(options: OperationalLoggerOptions);
    debug(input: TransientOperationalLogInput): Promise<OperationalLogWriteResult>;
    info(input: TransientOperationalLogInput): Promise<OperationalLogWriteResult>;
    milestone(input: MilestoneOperationalLogInput): Promise<OperationalLogWriteResult>;
    error(input: ErrorOperationalLogInput): Promise<OperationalLogWriteResult>;
    fatal(input: ErrorOperationalLogInput): Promise<OperationalLogWriteResult>;
    private writeTransient;
    private writeError;
    private writeCollectorOnlyError;
    private toPersistentRecord;
    private fanOut;
}
export {};
//# sourceMappingURL=OperationalLogger.d.ts.map