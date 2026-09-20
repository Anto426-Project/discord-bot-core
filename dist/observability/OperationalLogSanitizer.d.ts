import type { ErrorOperationalLogInput, OperationalLogContextInput, OperationalLogOutcome, OperationalLogPrimitive, OperationalLogReferences, TransientOperationalLogInput } from "./OperationalLogTypes.js";
export declare const redactOperationalText: (input: string, maximumLength: number) => string;
export type SanitizedOperationalContext = Readonly<{
    occurredAt: Date;
    correlationId: string;
    traceId?: string;
    references: OperationalLogReferences;
    durationMs?: number;
    outcome?: OperationalLogOutcome;
    attributes: Readonly<Record<string, OperationalLogPrimitive>>;
}>;
export declare const sanitizeOperationalContext: (input: OperationalLogContextInput, fallbackOccurredAt: Date) => SanitizedOperationalContext | null;
export type SanitizedTransientInput = SanitizedOperationalContext & Readonly<{
    eventKey: string;
    component: string;
    summary: string;
}>;
export declare const sanitizeTransientInput: (input: TransientOperationalLogInput, fallbackOccurredAt: Date) => SanitizedTransientInput | null;
export type SanitizedErrorInput = SanitizedOperationalContext & Readonly<{
    errorCode: string;
    component: string;
    safeSummary: string;
    errorClass: string;
    providerCode?: string;
    retryable: boolean;
    attemptNo?: number;
    normalizedCause: string;
    redactedStack?: string;
}>;
export declare const sanitizeErrorInput: (input: ErrorOperationalLogInput, fallbackOccurredAt: Date) => SanitizedErrorInput | null;
export declare const sanitizeCatalogEntry: (entry: {
    eventKey: string;
    component: string;
    description: string;
}) => Readonly<{
    eventKey: string;
    component: string;
    description: string;
}> | null;
//# sourceMappingURL=OperationalLogSanitizer.d.ts.map