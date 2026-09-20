import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { assertDiscordCommandPublicationSnapshot } from "./command-publisher.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake, parseStableBotKey } from "./identifiers.js";
const scopeKey = (scope) => {
    parseStableBotKey(scope.ownerKey);
    const application = parseDiscordSnowflake(scope.applicationId);
    return scope.kind === "global" ? `${application}:global` : `${application}:guild:${parseDiscordSnowflake(scope.guildId)}`;
};
const checkSignal = (signal) => {
    if (signal?.aborted)
        throw new DiscordCoreError("DISCORD_CANCELLED", "Command snapshot operation cancelled.", true);
};
const lostLease = () => { throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Command publication lease is no longer owned.", false); };
/** Durable command ownership, with an atomic lease shared by processes using this database. */
export class SqliteDiscordCommandPublicationSnapshotAdapter {
    now;
    database;
    constructor(filename, now = Date.now) {
        this.now = now;
        this.database = new DatabaseSync(filename);
        this.database.exec(`PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS command_leases(scope TEXT PRIMARY KEY, owner TEXT NOT NULL, id TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS command_snapshots(scope TEXT NOT NULL, owner TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(scope, owner));`);
    }
    close() { this.database.close(); }
    async claimScope(scope, durationMs, signal) {
        checkSignal(signal);
        if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > 300_000)
            throw new RangeError("Invalid command lease duration.");
        const key = scopeKey(scope), leaseId = randomUUID(), now = this.now(), expiresAtEpochMs = now + durationMs;
        const result = this.database.prepare(`INSERT INTO command_leases VALUES (?, ?, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET owner=excluded.owner,id=excluded.id,expires=excluded.expires WHERE command_leases.expires <= ?`).run(key, scope.ownerKey, leaseId, expiresAtEpochMs, now);
        return result.changes === 0 ? null : Object.freeze({ leaseId, providerScopeKey: key, expiresAtEpochMs });
    }
    async loadSnapshot(scope, lease, signal) {
        checkSignal(signal);
        this.assertLease(scope, lease);
        const row = this.database.prepare("SELECT body FROM command_snapshots WHERE scope=? AND owner=?").get(scopeKey(scope), scope.ownerKey);
        if (row === undefined)
            return null;
        const snapshot = JSON.parse(String(row["body"]));
        assertDiscordCommandPublicationSnapshot(snapshot, scope);
        return snapshot;
    }
    async saveSnapshot(scope, lease, snapshot, signal) {
        checkSignal(signal);
        assertDiscordCommandPublicationSnapshot(snapshot, scope);
        const key = scopeKey(scope);
        if (lease.providerScopeKey !== key)
            lostLease();
        // The lease predicate and write are one SQLite statement, including across processes.
        const result = this.database.prepare(`INSERT INTO command_snapshots(scope, owner, body)
      SELECT scope, owner, ? FROM command_leases WHERE scope=? AND owner=? AND id=? AND expires>?
      ON CONFLICT(scope, owner) DO UPDATE SET body=excluded.body`).run(JSON.stringify(snapshot), key, scope.ownerKey, lease.leaseId, this.now());
        if (result.changes !== 1)
            lostLease();
    }
    async releaseScope(scope, lease, _signal) {
        const key = scopeKey(scope);
        if (lease.providerScopeKey !== key)
            lostLease();
        this.database.prepare("DELETE FROM command_leases WHERE scope=? AND owner=? AND id=?").run(key, scope.ownerKey, lease.leaseId);
    }
    assertLease(scope, lease) {
        const key = scopeKey(scope);
        if (lease.providerScopeKey !== key || this.database.prepare("SELECT id FROM command_leases WHERE scope=? AND owner=? AND id=? AND expires>?").get(key, scope.ownerKey, lease.leaseId, this.now()) === undefined)
            lostLease();
    }
}
//# sourceMappingURL=node-storage.js.map