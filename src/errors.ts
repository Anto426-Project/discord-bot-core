export type DiscordCoreErrorCode =
  | "DISCORD_INVALID_INPUT"
  | "DISCORD_PAYLOAD_REJECTED"
  | "DISCORD_TIMEOUT"
  | "DISCORD_NETWORK_FAILURE"
  | "DISCORD_RATE_LIMITED"
  | "DISCORD_PROVIDER_FAILURE"
  | "DISCORD_CIRCUIT_OPEN"
  | "DISCORD_RESPONSE_INVALID"
  | "DISCORD_RESPONSE_TOO_LARGE";

export interface SafeDiscordCoreError {
  readonly code: DiscordCoreErrorCode;
  readonly safeSummary: string;
  readonly retryable: boolean;
  readonly providerStatus: number | null;
  readonly retryAfterMs: number | null;
}

const SUMMARY_MAX_LENGTH = 300;

const safeSummary = (value: string): string => {
  const normalized = redactDiscordSensitiveText(value).trim();
  return (normalized.length === 0 ? "Discord operation failed." : normalized).slice(
    0,
    SUMMARY_MAX_LENGTH,
  );
};

export class DiscordCoreError extends Error {
  public readonly safeSummary: string;

  public constructor(
    public readonly code: DiscordCoreErrorCode,
    summary: string,
    public readonly retryable: boolean,
    public readonly providerStatus: number | null = null,
    public readonly retryAfterMs: number | null = null,
    cause?: unknown,
  ) {
    super(safeSummary(summary), cause === undefined ? undefined : { cause });
    this.name = "DiscordCoreError";
    this.safeSummary = safeSummary(summary);
  }

  public toSafeRecord(): SafeDiscordCoreError {
    return Object.freeze({
      code: this.code,
      safeSummary: this.safeSummary,
      retryable: this.retryable,
      providerStatus: this.providerStatus,
      retryAfterMs: this.retryAfterMs,
    });
  }
}

export const redactDiscordSensitiveText = (input: string): string =>
  input
    .replace(/\bBot\s+[A-Za-z0-9._~+\/-]{20,}/giu, "Bot [redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/giu, "Bearer [redacted]")
    .replace(/\bmfa\.[A-Za-z0-9_-]{20,}/giu, "[redacted-token]")
    .replace(
      /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/giu,
      "https://discord.com/api/webhooks/[redacted]",
    )
    .replace(
      /\b(?:token|secret|authorization|api[_-]?key)\s*[:=]\s*[^\s,;&]+/giu,
      (match) => `${match.slice(0, Math.max(match.search(/[:=]/u), 0)) || "secret"}=[redacted]`,
    );
