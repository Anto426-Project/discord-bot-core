import { DiscordCoreError } from "./errors.js";
import { parseStableBotKey } from "./identifiers.js";

export interface DiscordEventIdempotencyPort {
  claim(key: string, ttlMs: number): Promise<boolean>;
  complete(key: string): Promise<void>;
  fail(key: string, code: string): Promise<void>;
}

export type DiscordEventHandlingContext = Readonly<{
  subscriptionId: string;
  eventName: string;
  idempotencyKey: string;
  signal: AbortSignal;
}>;

export interface DiscordEventSubscriptionRuntime {
  readonly subscriptionId: string;
  readonly eventName: string;
  prepare(arguments_: readonly unknown[]): Readonly<{
    idempotencyKey: string;
    execute(signal: AbortSignal): Promise<void>;
  }>;
}

export interface DiscordEventSubscriptionOptions<TPayload> {
  readonly subscriptionId: string;
  readonly eventName: string;
  readonly decode: (arguments_: readonly unknown[]) => TPayload;
  readonly idempotencyKey: (payload: TPayload) => string;
  readonly handler: (payload: TPayload, context: DiscordEventHandlingContext) => Promise<void>;
}

const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,127}$/u;

export const namespaceDiscordEventIdempotencyKey = (
  subscriptionId: string,
  consumerKey: string,
): string => {
  const subscription = parseStableBotKey(subscriptionId, "event subscription id");
  const key = consumerKey.trim();
  if (key.length < 1 || key.length > 256 || /[\u0000-\u001f\u007f]/u.test(key)) {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord event idempotency key is invalid.",
      false,
    );
  }
  return `discord-event/${encodeURIComponent(subscription)}/${encodeURIComponent(key)}`;
};

export class DiscordEventSubscription<TPayload> implements DiscordEventSubscriptionRuntime {
  public readonly subscriptionId: string;
  public readonly eventName: string;

  public constructor(private readonly options: DiscordEventSubscriptionOptions<TPayload>) {
    this.subscriptionId = parseStableBotKey(options.subscriptionId, "event subscription id");
    const eventName = options.eventName.trim();
    if (!EVENT_NAME_PATTERN.test(eventName)) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord event name is invalid.",
        false,
      );
    }
    this.eventName = eventName;
  }

  public prepare(arguments_: readonly unknown[]): Readonly<{
    idempotencyKey: string;
    execute(signal: AbortSignal): Promise<void>;
  }> {
    const payload = this.options.decode(arguments_);
    const idempotencyKey = namespaceDiscordEventIdempotencyKey(
      this.subscriptionId,
      this.options.idempotencyKey(payload),
    );
    return Object.freeze({
      idempotencyKey,
      execute: async (signal: AbortSignal): Promise<void> => {
        await this.options.handler(
          payload,
          Object.freeze({
            subscriptionId: this.subscriptionId,
            eventName: this.eventName,
            idempotencyKey,
            signal,
          }),
        );
      },
    });
  }
}

export type DiscordEventFailure = Readonly<{
  subscriptionId: string;
  eventName: string;
  argumentCount: number;
  code: string;
}>;

export interface DiscordEventErrorReporter {
  report(failure: DiscordEventFailure): Promise<void>;
}

export type DiscordEventSubscriptionOutcome =
  | Readonly<{ status: "handled"; subscriptionId: string; idempotencyKey: string }>
  | Readonly<{ status: "duplicate"; subscriptionId: string; idempotencyKey: string }>
  | Readonly<{ status: "failed"; subscriptionId: string; code: string }>;

export type DiscordEventDispatchResult =
  | Readonly<{ status: "dispatched"; eventName: string; outcomes: readonly DiscordEventSubscriptionOutcome[] }>
  | Readonly<{ status: "not_registered"; eventName: string }>;

const errorCode = (error: unknown): string =>
  error instanceof DiscordCoreError
    ? error.code
    : error instanceof Error && /^[A-Z][A-Z0-9_.-]{2,127}$/u.test(error.name)
      ? error.name
      : "DISCORD_EVENT_HANDLER_FAILED";

const reportSafely = async (
  reporter: DiscordEventErrorReporter,
  failure: DiscordEventFailure,
): Promise<void> => {
  try {
    await Promise.race([
      reporter.report(failure),
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1_000);
        timer.unref?.();
      }),
    ]);
  } catch {
    // Event failures stay isolated when telemetry is unavailable.
  }
};

const executeBounded = async (
  operation: Promise<void>,
  signal: AbortSignal,
): Promise<void> => {
  await Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  ]);
};

const persistenceBounded = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  const signal = AbortSignal.timeout(timeoutMs);
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () =>
          reject(
            new DiscordCoreError(
              "DISCORD_TIMEOUT",
              "Discord event idempotency operation timed out.",
              true,
              null,
              null,
              signal.reason,
            ),
          ),
        { once: true },
      );
    }),
  ]);
};

export class DiscordEventRouter {
  private readonly subscriptions: ReadonlyMap<string, readonly DiscordEventSubscriptionRuntime[]>;

  public constructor(
    subscriptions: readonly DiscordEventSubscriptionRuntime[],
    private readonly idempotency: DiscordEventIdempotencyPort,
    private readonly errors: DiscordEventErrorReporter,
    private readonly options: Readonly<{
      handlerTimeoutMs?: number;
      idempotencyTtlMs?: number;
      persistenceTimeoutMs?: number;
    }> = {},
  ) {
    const ids = new Set<string>();
    const byName = new Map<string, DiscordEventSubscriptionRuntime[]>();
    for (const subscription of subscriptions) {
      if (ids.has(subscription.subscriptionId)) {
        throw new DiscordCoreError(
          "DISCORD_INVALID_INPUT",
          "Discord event subscription ids must be unique.",
          false,
        );
      }
      ids.add(subscription.subscriptionId);
      const entries = byName.get(subscription.eventName) ?? [];
      entries.push(subscription);
      byName.set(subscription.eventName, entries);
    }
    this.subscriptions = new Map(
      [...byName].map(([name, entries]) => [name, Object.freeze([...entries])]),
    );
    this.handlerTimeoutMs();
    this.idempotencyTtlMs();
    this.persistenceTimeoutMs();
  }

  private handlerTimeoutMs(): number {
    const value = this.options.handlerTimeoutMs ?? 10_000;
    if (!Number.isSafeInteger(value) || value < 100 || value > 60_000) {
      throw new RangeError("Discord event handler timeout must be from 100 to 60000 ms.");
    }
    return value;
  }

  private idempotencyTtlMs(): number {
    const value = this.options.idempotencyTtlMs ?? 86_400_000;
    if (!Number.isSafeInteger(value) || value < 1_000 || value > 604_800_000) {
      throw new RangeError("Discord event idempotency TTL must be from 1 second to 7 days.");
    }
    return value;
  }

  private persistenceTimeoutMs(): number {
    const value = this.options.persistenceTimeoutMs ?? 3_000;
    if (!Number.isSafeInteger(value) || value < 100 || value > 30_000) {
      throw new RangeError("Discord event persistence timeout must be from 100 to 30000 ms.");
    }
    return value;
  }

  public registeredEventNames(): readonly string[] {
    return Object.freeze([...this.subscriptions.keys()].sort());
  }

  public async dispatch(
    eventName: string,
    arguments_: readonly unknown[],
  ): Promise<DiscordEventDispatchResult> {
    const subscriptions = this.subscriptions.get(eventName);
    if (subscriptions === undefined) return Object.freeze({ status: "not_registered", eventName });
    const outcomes: DiscordEventSubscriptionOutcome[] = [];

    for (const subscription of subscriptions) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DiscordCoreError("DISCORD_TIMEOUT", "Discord event handler timed out.", true)),
        this.handlerTimeoutMs(),
      );
      timer.unref?.();
      let key: string | null = null;
      let claimed = false;
      try {
        const prepared = subscription.prepare(arguments_);
        key = prepared.idempotencyKey;
        claimed = await persistenceBounded(
          this.idempotency.claim(key, this.idempotencyTtlMs()),
          this.persistenceTimeoutMs(),
        );
        if (!claimed) {
          outcomes.push({ status: "duplicate", subscriptionId: subscription.subscriptionId, idempotencyKey: key });
          continue;
        }
        await executeBounded(prepared.execute(controller.signal), controller.signal);
        await persistenceBounded(
          this.idempotency.complete(key),
          this.persistenceTimeoutMs(),
        );
        outcomes.push({ status: "handled", subscriptionId: subscription.subscriptionId, idempotencyKey: key });
      } catch (error: unknown) {
        const code = errorCode(error);
        // Once claimed, never release automatically: a timed-out/non-cooperative
        // handler or failed completion write has an uncertain side-effect state.
        // The durable store retains the claim and records failure for an explicit
        // recovery worker, preventing concurrent duplicate execution.
        if (key !== null && claimed) {
          await persistenceBounded(
            this.idempotency.fail(key, code),
            this.persistenceTimeoutMs(),
          ).catch(() => undefined);
        }
        await reportSafely(this.errors, {
          subscriptionId: subscription.subscriptionId,
          eventName: subscription.eventName,
          argumentCount: Math.min(arguments_.length, 64),
          code,
        });
        outcomes.push({ status: "failed", subscriptionId: subscription.subscriptionId, code });
      } finally {
        clearTimeout(timer);
      }
    }
    return Object.freeze({ status: "dispatched", eventName, outcomes: Object.freeze(outcomes) });
  }
}

export const singleDiscordEventArgument = <TPayload>(
  label: string,
  guard: (value: unknown) => value is TPayload,
): ((arguments_: readonly unknown[]) => TPayload) =>
  (arguments_): TPayload => {
    if (arguments_.length !== 1 || !guard(arguments_[0])) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        `Discord event '${label}' does not match its one-argument schema.`,
        false,
      );
    }
    return arguments_[0];
  };
