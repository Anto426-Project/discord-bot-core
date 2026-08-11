export type DiscordCoreErrorCode = "DISCORD_INVALID_INPUT" | "DISCORD_PAYLOAD_REJECTED" | "DISCORD_CANCELLED" | "DISCORD_TIMEOUT" | "DISCORD_NETWORK_FAILURE" | "DISCORD_RATE_LIMITED" | "DISCORD_RECIPIENT_UNREACHABLE" | "DISCORD_OUTCOME_UNKNOWN" | "DISCORD_PROVIDER_FAILURE" | "DISCORD_CIRCUIT_OPEN" | "DISCORD_RESPONSE_INVALID" | "DISCORD_RESPONSE_TOO_LARGE";
export interface SafeDiscordCoreError {
    readonly code: DiscordCoreErrorCode;
    readonly safeSummary: string;
    readonly retryable: boolean;
    readonly providerStatus: number | null;
    readonly retryAfterMs: number | null;
}
export declare class DiscordCoreError extends Error {
    readonly code: DiscordCoreErrorCode;
    readonly retryable: boolean;
    readonly providerStatus: number | null;
    readonly retryAfterMs: number | null;
    readonly safeSummary: string;
    constructor(code: DiscordCoreErrorCode, summary: string, retryable: boolean, providerStatus?: number | null, retryAfterMs?: number | null, _cause?: unknown);
    toSafeRecord(): SafeDiscordCoreError;
    toJSON(): SafeDiscordCoreError;
}
export declare const redactDiscordSensitiveText: (input: string) => string;
//# sourceMappingURL=errors.d.ts.map