import { createHash } from "node:crypto";

import {
  toDiscordApplicationCommand,
  type ChatInputCommandPlan,
  type DiscordApplicationCommandBody,
} from "./command-model.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake, parseStableBotKey } from "./identifiers.js";

/**
 * Bulk publication is permitted only when one process owns the complete
 * application-command collection for the selected scope. This explicit
 * declaration prevents a shared library from guessing ownership and deleting
 * another process' commands.
 */
export type DiscordCommandPublicationScope =
  | Readonly<{
      kind: "global";
      ownership: "exclusive";
      ownerKey: string;
      applicationId: string;
    }>
  | Readonly<{
      kind: "guild";
      ownership: "exclusive";
      ownerKey: string;
      applicationId: string;
      guildId: string;
    }>;

export type DiscordPublishedCommandReceipt = Readonly<{
  id: string;
  name: string;
}>;

export interface DiscordApplicationCommandsRestPort {
  replaceApplicationCommands(
    scope: DiscordCommandPublicationScope,
    commands: readonly DiscordApplicationCommandBody[],
  ): Promise<readonly DiscordPublishedCommandReceipt[]>;
}

export type DiscordCommandSnapshotEntry = Readonly<{
  key: string;
  commandName: string;
  fingerprint: string;
  providerCommandId: string;
}>;

export type DiscordCommandPublicationSnapshot = Readonly<{
  schemaVersion: 4;
  ownerKey: string;
  scopeKind: DiscordCommandPublicationScope["kind"];
  applicationId: string;
  guildId: string | null;
  catalogFingerprint: string;
  commands: readonly DiscordCommandSnapshotEntry[];
}>;

export interface DiscordCommandPublicationSnapshotPort {
  save(snapshot: DiscordCommandPublicationSnapshot): Promise<void>;
}

export type DiscordCommandPublicationResult = Readonly<{
  status: "reconciled";
  snapshot: DiscordCommandPublicationSnapshot;
}>;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  throw new DiscordCoreError(
    "DISCORD_INVALID_INPUT",
    "Discord command payload contains an unsupported value.",
    false,
  );
};

export const fingerprintDiscordCommand = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");

const normalizeScope = (scope: DiscordCommandPublicationScope): DiscordCommandPublicationScope => {
  if (scope.ownership !== "exclusive") {
    throw new DiscordCoreError(
      "DISCORD_INVALID_INPUT",
      "Discord command publication requires exclusive scope ownership.",
      false,
    );
  }
  const common = {
    ownership: "exclusive" as const,
    ownerKey: parseStableBotKey(scope.ownerKey, "command owner key"),
    applicationId: parseDiscordSnowflake(scope.applicationId, "Discord application id"),
  };
  return scope.kind === "global"
    ? Object.freeze({ kind: "global", ...common })
    : Object.freeze({
        kind: "guild",
        ...common,
        guildId: parseDiscordSnowflake(scope.guildId, "Discord guild id"),
      });
};

export class DiscordCommandPublisher {
  public constructor(
    private readonly rest: DiscordApplicationCommandsRestPort,
    private readonly snapshots: DiscordCommandPublicationSnapshotPort,
  ) {}

  public async publish(
    requestedScope: DiscordCommandPublicationScope,
    commands: readonly ChatInputCommandPlan[],
  ): Promise<DiscordCommandPublicationResult> {
    const scope = normalizeScope(requestedScope);
    if (commands.length > 100) {
      throw new DiscordCoreError(
        "DISCORD_INVALID_INPUT",
        "Discord command catalog exceeds the scope limit.",
        false,
      );
    }
    const keys = new Set<string>();
    const names = new Set<string>();
    const prepared = commands
      .map((command) => {
        const key = parseStableBotKey(command.key, "command key");
        if (keys.has(key) || names.has(command.name.en)) {
          throw new DiscordCoreError(
            "DISCORD_INVALID_INPUT",
            "Discord command keys and names must be unique.",
            false,
          );
        }
        keys.add(key);
        names.add(command.name.en);
        const body = toDiscordApplicationCommand(command, scope.kind);
        return Object.freeze({ key, body, fingerprint: fingerprintDiscordCommand(body) });
      })
      .sort((left, right) => left.key.localeCompare(right.key));

    // PUT bulk overwrite is idempotent for an exclusively owned scope. If the
    // process crashes after provider success but before snapshot persistence,
    // replaying the same complete catalog converges without duplicate commands.
    const receipts = await this.rest.replaceApplicationCommands(
      scope,
      Object.freeze(prepared.map((entry) => entry.body)),
    );
    if (receipts.length !== prepared.length) {
      throw new DiscordCoreError(
        "DISCORD_RESPONSE_INVALID",
        "Discord command replacement receipt count is invalid.",
        false,
      );
    }
    const receiptByName = new Map<string, DiscordPublishedCommandReceipt>();
    for (const receipt of receipts) {
      const id = parseDiscordSnowflake(receipt.id, "Discord command receipt id");
      const name = receipt.name.trim();
      if (name.length === 0 || receiptByName.has(name)) {
        throw new DiscordCoreError(
          "DISCORD_RESPONSE_INVALID",
          "Discord command replacement returned duplicate or malformed receipts.",
          false,
        );
      }
      receiptByName.set(name, Object.freeze({ id, name }));
    }

    const entries = Object.freeze(
      prepared.map((entry) => {
        const receipt = receiptByName.get(entry.body.name);
        if (receipt === undefined) {
          throw new DiscordCoreError(
            "DISCORD_RESPONSE_INVALID",
            "Discord command replacement omitted a desired command.",
            false,
          );
        }
        return Object.freeze({
          key: entry.key,
          commandName: entry.body.name,
          fingerprint: entry.fingerprint,
          providerCommandId: receipt.id,
        });
      }),
    );
    const snapshot: DiscordCommandPublicationSnapshot = Object.freeze({
      schemaVersion: 4,
      ownerKey: scope.ownerKey,
      scopeKind: scope.kind,
      applicationId: scope.applicationId,
      guildId: scope.kind === "guild" ? scope.guildId : null,
      catalogFingerprint: fingerprintDiscordCommand(
        entries.map(({ providerCommandId: _providerCommandId, ...entry }) => entry),
      ),
      commands: entries,
    });
    await this.snapshots.save(snapshot);
    return Object.freeze({ status: "reconciled", snapshot });
  }
}

const copySnapshot = (
  snapshot: DiscordCommandPublicationSnapshot,
): DiscordCommandPublicationSnapshot =>
  Object.freeze({
    ...snapshot,
    commands: Object.freeze(snapshot.commands.map((entry) => Object.freeze({ ...entry }))),
  });

export class InMemoryDiscordCommandPublicationSnapshotAdapter
  implements DiscordCommandPublicationSnapshotPort
{
  private readonly snapshots = new Map<string, DiscordCommandPublicationSnapshot>();

  public async save(snapshot: DiscordCommandPublicationSnapshot): Promise<void> {
    const key =
      snapshot.scopeKind === "global"
        ? `${snapshot.ownerKey}:${snapshot.applicationId}:global`
        : `${snapshot.ownerKey}:${snapshot.applicationId}:guild:${snapshot.guildId ?? ""}`;
    this.snapshots.set(key, copySnapshot(snapshot));
  }

  public values(): readonly DiscordCommandPublicationSnapshot[] {
    return Object.freeze([...this.snapshots.values()].map(copySnapshot));
  }
}
