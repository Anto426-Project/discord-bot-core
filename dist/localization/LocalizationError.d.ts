export type LocalizationErrorCode = "LOCALIZATION.INVALID_CATALOG" | "LOCALIZATION.INVALID_PARAMETER" | "LOCALIZATION.INVALID_TEMPLATE" | "LOCALIZATION.MISSING_PARAMETER" | "LOCALIZATION.TRANSLATOR_REQUIRED" | "LOCALIZATION.UNKNOWN_KEY" | "LOCALIZATION.UNSUPPORTED_LOCALE" | "LOCALIZATION.UNUSED_PARAMETER";
export declare class LocalizationError extends Error {
    readonly code: LocalizationErrorCode;
    readonly details: Readonly<Record<string, unknown>> | undefined;
    constructor(code: LocalizationErrorCode, message: string, details?: Readonly<Record<string, unknown>>);
}
//# sourceMappingURL=LocalizationError.d.ts.map