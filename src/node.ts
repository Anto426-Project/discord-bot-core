import {
  type DiscordApplicationCommandBody,
} from "./command-model.js";
import {
  type DiscordApplicationCommandsRestPort,
  type DiscordCommandPublicationScope,
  type DiscordPublishedCommandReceipt,
} from "./command-publisher.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake } from "./identifiers.js";
import {
  createSafeDiscordMessage,
  type SafeDiscordMessageInput,
} from "./payload.js";
import { executeWithDiscordRetry, type DiscordRetryPolicy } from "./retry.js";

const DISCORD_API_ORIGIN = "https://discord.com";
const DISCORD_API_PREFIX = "/api/v10";

export type DiscordFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface NodeDiscordRestClientOptions {
  readonly botToken: string;
  readonly fetch?: DiscordFetch;
  readonly timeoutMs?: number;
  readonly maximumResponseBytes?: number;
  readonly retry?: DiscordRetryPolicy;
  readonly circuitFailureThreshold?: number;
  readonly circuitCooldownMs?: number;
  readonly now?: () => number;
}

export type DiscordDeliveryReceipt = Readonly<{
  messageId: string;
  channelId: string;
}>;

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return resolved;
};

const token = (value: string): string => {
  const normalized = value.trim();
  if (
    normalized.length < 20 ||
    normalized.length > 512 ||
    /[\s\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new TypeError("Discord bot token is invalid.");
  }
  return normalized;
};

const readBoundedUtf8 = async (response: Response, maximumBytes: number): Promise<string> => {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maximumBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_TOO_LARGE",
        "Discord response exceeds the configured limit.",
        false,
        response.status,
      );
    }
  }
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_TOO_LARGE",
          "Discord response exceeds the configured limit.",
          false,
          response.status,
        );
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error: unknown) {
    if (error instanceof DiscordCoreError) throw error;
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord returned invalid UTF-8.",
      false,
      response.status,
      null,
      error,
    );
  } finally {
    reader.releaseLock();
  }
};

const parseJson = (text: string, status: number): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord returned invalid JSON.",
      false,
      status,
      null,
      error,
    );
  }
};

const retryAfterMs = (response: Response, body: unknown): number => {
  const fromBody =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)["retry_after"]
      : undefined;
  const seconds =
    typeof fromBody === "number"
      ? fromBody
      : Number(response.headers.get("retry-after") ?? "0");
  if (!Number.isFinite(seconds) || seconds < 0) return 1_000;
  return Math.min(60_000, Math.max(0, Math.ceil(seconds * 1_000)));
};

const responseRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscordCoreError(
      "DISCORD_RESPONSE_INVALID",
      "Discord response shape is invalid.",
      false,
    );
  }
  return value as Record<string, unknown>;
};

export class NodeDiscordRestClient implements DiscordApplicationCommandsRestPort {
  private readonly token: string;
  private readonly fetch: DiscordFetch;
  private readonly timeoutMs: number;
  private readonly maximumResponseBytes: number;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private halfOpen = false;

  public constructor(private readonly options: NodeDiscordRestClientOptions) {
    this.token = token(options.botToken);
    this.fetch = options.fetch ?? fetch;
    this.timeoutMs = boundedInteger(options.timeoutMs, 5_000, 100, 30_000, "timeoutMs");
    this.maximumResponseBytes = boundedInteger(
      options.maximumResponseBytes,
      262_144,
      1_024,
      1_048_576,
      "maximumResponseBytes",
    );
    this.failureThreshold = boundedInteger(
      options.circuitFailureThreshold,
      5,
      2,
      20,
      "circuitFailureThreshold",
    );
    this.cooldownMs = boundedInteger(
      options.circuitCooldownMs,
      30_000,
      1_000,
      300_000,
      "circuitCooldownMs",
    );
    this.now = options.now ?? Date.now;
  }

  private beforeAttempt(): void {
    const now = this.now();
    if (this.circuitOpenUntil > now) {
      throw new DiscordCoreError(
        "DISCORD_CIRCUIT_OPEN",
        "Discord provider circuit is open.",
        true,
        null,
        this.circuitOpenUntil - now,
      );
    }
    if (this.circuitOpenUntil !== 0) {
      if (this.halfOpen) {
        throw new DiscordCoreError(
          "DISCORD_CIRCUIT_OPEN",
          "Discord provider circuit recovery probe is already running.",
          true,
          null,
          this.cooldownMs,
        );
      }
      this.halfOpen = true;
    }
  }

  private success(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
    this.halfOpen = false;
  }

  private failure(): void {
    this.halfOpen = false;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitOpenUntil = this.now() + this.cooldownMs;
    }
  }

  private async requestOnce(input: {
    readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    readonly path: string;
    readonly body?: unknown;
    readonly signal?: AbortSignal;
  }): Promise<unknown> {
    this.beforeAttempt();
    const deadline = AbortSignal.timeout(this.timeoutMs);
    const signal = input.signal === undefined ? deadline : AbortSignal.any([input.signal, deadline]);
    let response: Response;
    try {
      response = await this.fetch(`${DISCORD_API_ORIGIN}${DISCORD_API_PREFIX}${input.path}`, {
        method: input.method,
        headers: {
          authorization: `Bot ${this.token}`,
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "AntoProject-DiscordBotCore/0.1.0",
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        redirect: "error",
        signal,
      });
    } catch (error: unknown) {
      this.failure();
      if (signal.aborted) {
        throw new DiscordCoreError(
          "DISCORD_TIMEOUT",
          "Discord request exceeded its deadline.",
          true,
          null,
          null,
          error,
        );
      }
      throw new DiscordCoreError(
        "DISCORD_NETWORK_FAILURE",
        "Discord request failed before a response was received.",
        true,
        null,
        null,
        error,
      );
    }

    const text = await readBoundedUtf8(response, this.maximumResponseBytes);
    const body = parseJson(text, response.status);
    if (response.ok) {
      this.success();
      return body;
    }
    if (response.status === 429) {
      throw new DiscordCoreError(
        "DISCORD_RATE_LIMITED",
        "Discord rate limit was reached.",
        true,
        429,
        retryAfterMs(response, body),
      );
    }
    const retryable = response.status >= 500;
    if (retryable) this.failure();
    else this.halfOpen = false;
    throw new DiscordCoreError(
      "DISCORD_PROVIDER_FAILURE",
      "Discord rejected the provider request.",
      retryable,
      response.status,
    );
  }

  private async request(input: {
    readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    readonly path: string;
    readonly body?: unknown;
    readonly retryable: boolean;
    readonly signal?: AbortSignal;
  }): Promise<unknown> {
    if (!input.retryable) return this.requestOnce(input);
    return executeWithDiscordRetry({
      operation: ({ signal }) => this.requestOnce({ ...input, signal }),
      decide: (error) =>
        error instanceof DiscordCoreError && error.retryable
          ? { retry: true, ...(error.retryAfterMs === null ? {} : { retryAfterMs: error.retryAfterMs }) }
          : { retry: false },
      signal: input.signal,
      policy: this.options.retry,
    });
  }

  public async replaceApplicationCommands(
    scope: DiscordCommandPublicationScope,
    commands: readonly DiscordApplicationCommandBody[],
  ): Promise<readonly DiscordPublishedCommandReceipt[]> {
    const applicationId = parseDiscordSnowflake(scope.applicationId, "Discord application id");
    const path =
      scope.kind === "global"
        ? `/applications/${applicationId}/commands`
        : `/applications/${applicationId}/guilds/${parseDiscordSnowflake(scope.guildId, "Discord guild id")}/commands`;
    const value = await this.request({ method: "PUT", path, body: commands, retryable: true });
    if (!Array.isArray(value) || value.length > 100) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord command replacement response is invalid.",
        false,
      );
    }
    return Object.freeze(
      value.map((entry) => {
        const record = responseRecord(entry);
        return Object.freeze({
          id: parseDiscordSnowflake(String(record["id"] ?? ""), "Discord command id"),
          name:
            typeof record["name"] === "string" && record["name"].trim().length > 0
              ? record["name"].trim()
              : (() => {
                  throw new DiscordCoreError(
                    "DISCORD_RESPONSE_INVALID",
                    "Discord command receipt name is invalid.",
                    false,
                  );
                })(),
        });
      }),
    );
  }

  public async sendChannelMessage(input: {
    readonly channelId: string;
    readonly message: SafeDiscordMessageInput;
    readonly signal?: AbortSignal;
  }): Promise<DiscordDeliveryReceipt> {
    const channelId = parseDiscordSnowflake(input.channelId, "Discord channel id");
    const value = await this.request({
      method: "POST",
      path: `/channels/${channelId}/messages`,
      body: createSafeDiscordMessage(input.message),
      retryable: true,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    return this.deliveryReceipt(value);
  }

  public async sendDirectMessage(input: {
    readonly recipientId: string;
    readonly message: SafeDiscordMessageInput;
    readonly signal?: AbortSignal;
  }): Promise<DiscordDeliveryReceipt> {
    const recipientId = parseDiscordSnowflake(input.recipientId, "Discord recipient id");
    const channelValue = await this.request({
      method: "POST",
      path: "/users/@me/channels",
      body: Object.freeze({ recipient_id: recipientId }),
      retryable: true,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const channel = responseRecord(channelValue);
    const channelId = parseDiscordSnowflake(String(channel["id"] ?? ""), "Discord DM channel id");
    return this.sendChannelMessage({
      channelId,
      message: input.message,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  }

  private deliveryReceipt(value: unknown): DiscordDeliveryReceipt {
    const record = responseRecord(value);
    return Object.freeze({
      messageId: parseDiscordSnowflake(String(record["id"] ?? ""), "Discord message id"),
      channelId: parseDiscordSnowflake(String(record["channel_id"] ?? ""), "Discord message channel id"),
    });
  }
}
