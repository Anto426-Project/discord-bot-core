const SUMMARY_MAX_LENGTH = 300;
const safeSummary = (value) => {
    const normalized = redactDiscordSensitiveText(value).trim();
    return (normalized.length === 0 ? "Discord operation failed." : normalized).slice(0, SUMMARY_MAX_LENGTH);
};
export class DiscordCoreError extends Error {
    code;
    retryable;
    providerStatus;
    retryAfterMs;
    safeSummary;
    constructor(code, summary, retryable, providerStatus = null, retryAfterMs = null, _cause) {
        // Provider/native causes are deliberately not retained. Generic redaction
        // cannot prove that an unknown error message does not contain the exact bot
        // token, interaction token or provider response body.
        super(safeSummary(summary));
        this.code = code;
        this.retryable = retryable;
        this.providerStatus = providerStatus;
        this.retryAfterMs = retryAfterMs;
        this.name = "DiscordCoreError";
        this.safeSummary = safeSummary(summary);
    }
    toSafeRecord() {
        return Object.freeze({
            code: this.code,
            safeSummary: this.safeSummary,
            retryable: this.retryable,
            providerStatus: this.providerStatus,
            retryAfterMs: this.retryAfterMs,
        });
    }
    toJSON() {
        return this.toSafeRecord();
    }
}
export const redactDiscordSensitiveText = (input) => input
    .replace(/\bBot\s+[A-Za-z0-9._~+\/-]{20,}/giu, "Bot [redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/giu, "Bearer [redacted]")
    .replace(/\bmfa\.[A-Za-z0-9_-]{20,}/giu, "[redacted-token]")
    .replace(/https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/(?:webhooks|interactions)\/\d+\/[A-Za-z0-9._-]+/giu, "https://discord.com/api/webhooks/[redacted]")
    .replace(/"(?:token|secret|authorization|api[_-]?key)"\s*:\s*"[^"]*"/giu, (match) => `${match.slice(0, match.indexOf(":") + 1)}"[redacted]"`)
    .replace(/\b(?:token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;&]+/giu, (match) => `${match.slice(0, Math.max(match.search(/[:=]/u), 0)) || "secret"}=[redacted]`);
//# sourceMappingURL=errors.js.map