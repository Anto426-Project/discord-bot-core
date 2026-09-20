import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { DiscordCommandPublicationLease, DiscordCommandPublicationScope, DiscordCommandPublicationSnapshot, DiscordCommandPublicationSnapshotPort } from "./command-publisher.js";
import { assertDiscordCommandPublicationSnapshot } from "./command-publisher.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake, parseStableBotKey } from "./identifiers.js";

const scopeKey = (scope: DiscordCommandPublicationScope): string => {
  parseStableBotKey(scope.ownerKey);
  const application = parseDiscordSnowflake(scope.applicationId);
  return scope.kind === "global" ? `${application}:global` : `${application}:guild:${parseDiscordSnowflake(scope.guildId)}`;
};
const checkSignal = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DiscordCoreError("DISCORD_CANCELLED", "Command snapshot operation cancelled.", true);
};
const lostLease = (): never => { throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Command publication lease is no longer owned.", false); };

/** Durable command ownership, with an atomic lease shared by processes using this database. */
export class SqliteDiscordCommandPublicationSnapshotAdapter implements DiscordCommandPublicationSnapshotPort {
  private readonly database: DatabaseSync;
  public constructor(filename: string, private readonly now: () => number = Date.now) {
    this.database = new DatabaseSync(filename);
    this.database.exec(`PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS command_leases(scope TEXT PRIMARY KEY, owner TEXT NOT NULL, id TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS command_snapshots(scope TEXT NOT NULL, owner TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(scope, owner));`);
  }
  public close(): void { this.database.close(); }
  public async claimScope(scope: DiscordCommandPublicationScope, durationMs: number, signal?: AbortSignal): Promise<DiscordCommandPublicationLease | null> {
    checkSignal(signal);
    if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > 300_000) throw new RangeError("Invalid command lease duration.");
    const key = scopeKey(scope), leaseId = randomUUID(), now = this.now(), expiresAtEpochMs = now + durationMs;
    const result = this.database.prepare(`INSERT INTO command_leases VALUES (?, ?, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET owner=excluded.owner,id=excluded.id,expires=excluded.expires WHERE command_leases.expires <= ?`).run(key, scope.ownerKey, leaseId, expiresAtEpochMs, now);
    return result.changes === 0 ? null : Object.freeze({ leaseId, providerScopeKey: key, expiresAtEpochMs });
  }
  public async loadSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<DiscordCommandPublicationSnapshot | null> {
    checkSignal(signal);
    this.assertLease(scope, lease);
    const row = this.database.prepare("SELECT body FROM command_snapshots WHERE scope=? AND owner=?").get(scopeKey(scope), scope.ownerKey);
    if (row === undefined) return null;
    const snapshot = JSON.parse(String(row["body"])) as DiscordCommandPublicationSnapshot;
    assertDiscordCommandPublicationSnapshot(snapshot, scope);
    return snapshot;
  }
  public async saveSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, snapshot: DiscordCommandPublicationSnapshot, signal?: AbortSignal): Promise<void> {
    checkSignal(signal);
    assertDiscordCommandPublicationSnapshot(snapshot, scope);
    const key = scopeKey(scope);
    if (lease.providerScopeKey !== key) lostLease();
    // The lease predicate and write are one SQLite statement, including across processes.
    const result = this.database.prepare(`INSERT INTO command_snapshots(scope, owner, body)
      SELECT scope, owner, ? FROM command_leases WHERE scope=? AND owner=? AND id=? AND expires>?
      ON CONFLICT(scope, owner) DO UPDATE SET body=excluded.body`).run(JSON.stringify(snapshot), key, scope.ownerKey, lease.leaseId, this.now());
    if (result.changes !== 1) lostLease();
  }
  public async releaseScope(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, _signal?: AbortSignal): Promise<void> {
    const key = scopeKey(scope);
    if (lease.providerScopeKey !== key) lostLease();
    this.database.prepare("DELETE FROM command_leases WHERE scope=? AND owner=? AND id=?").run(key, scope.ownerKey, lease.leaseId);
  }
  private assertLease(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease): void {
    const key = scopeKey(scope);
    if (lease.providerScopeKey !== key || this.database.prepare("SELECT id FROM command_leases WHERE scope=? AND owner=? AND id=? AND expires>?").get(key, scope.ownerKey, lease.leaseId, this.now()) === undefined) lostLease();
  }
}
