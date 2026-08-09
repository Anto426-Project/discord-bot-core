import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DiscordCommandPublisher,
  DiscordCoreError,
  InMemoryDiscordCommandPublicationSnapshotAdapter,
  fingerprintDiscordChatInputCommand,
  type ChatInputCommandPlan,
  type DiscordApplicationCommandBody,
  type DiscordApplicationCommandsRestPort,
  type DiscordCommandPublicationLease,
  type DiscordCommandPublicationScope,
  type DiscordCommandPublicationSnapshot,
  type DiscordCommandPublicationSnapshotPort,
  type DiscordRemoteApplicationCommand,
} from "../src/index.js";

const scope: DiscordCommandPublicationScope = Object.freeze({
  kind: "guild",
  ownership: "provider_command_id",
  ownerKey: "tests.bot",
  applicationId: "100000000000000001",
  guildId: "100000000000000002",
});

const command = (key = "help.command", name = "help"): ChatInputCommandPlan =>
  Object.freeze({
    key,
    name: { it: name === "help" ? "aiuto" : name, en: name },
    description: { it: "Descrizione", en: "Description" },
    options: Object.freeze([]),
    allowInDirectMessages: true,
    defaultMemberPermissions: null,
  });

const remoteCommand = (
  id: string,
  body: DiscordApplicationCommandBody,
): DiscordRemoteApplicationCommand =>
  Object.freeze({
    id,
    name: body.name,
    kind: "chat_input",
    fingerprint: fingerprintDiscordChatInputCommand(body, scope.kind),
  });

class MemoryRest implements DiscordApplicationCommandsRestPort {
  public readonly commands = new Map<string, DiscordRemoteApplicationCommand>();
  public creates = 0;
  public updates = 0;
  public deletes = 0;
  public lists = 0;
  private nextId = 10;

  public async listApplicationCommands(
    _scope: DiscordCommandPublicationScope,
    signal?: AbortSignal,
  ): Promise<readonly DiscordRemoteApplicationCommand[]> {
    this.throwIfAborted(signal);
    this.lists += 1;
    return Object.freeze([...this.commands.values()]);
  }

  public async createApplicationCommand(
    _scope: DiscordCommandPublicationScope,
    body: DiscordApplicationCommandBody,
    signal?: AbortSignal,
  ): Promise<DiscordRemoteApplicationCommand> {
    this.throwIfAborted(signal);
    this.creates += 1;
    const id = `1000000000000000${this.nextId}`;
    this.nextId += 1;
    const result = remoteCommand(id, body);
    this.commands.set(id, result);
    return result;
  }

  public async updateApplicationCommand(
    _scope: DiscordCommandPublicationScope,
    providerCommandId: string,
    body: DiscordApplicationCommandBody,
    signal?: AbortSignal,
  ): Promise<DiscordRemoteApplicationCommand> {
    this.throwIfAborted(signal);
    assert.equal(this.commands.get(providerCommandId)?.kind, "chat_input");
    this.updates += 1;
    const result = remoteCommand(providerCommandId, body);
    this.commands.set(providerCommandId, result);
    return result;
  }

  public async deleteApplicationCommand(
    _scope: DiscordCommandPublicationScope,
    providerCommandId: string,
    signal?: AbortSignal,
  ): Promise<"deleted" | "already_absent"> {
    this.throwIfAborted(signal);
    this.deletes += 1;
    return this.commands.delete(providerCommandId) ? "deleted" : "already_absent";
  }

  private throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted === true) throw new Error("aborted");
  }
}

class FailOneCheckpointSnapshotPort implements DiscordCommandPublicationSnapshotPort {
  public saveCalls = 0;
  public failed = false;

  public constructor(
    private readonly inner: DiscordCommandPublicationSnapshotPort,
    private readonly failAtSave: number,
  ) {}

  public claimScope(
    claimedScope: DiscordCommandPublicationScope,
    durationMs: number,
    signal?: AbortSignal,
  ): Promise<DiscordCommandPublicationLease | null> {
    return this.inner.claimScope(claimedScope, durationMs, signal);
  }

  public loadSnapshot(
    claimedScope: DiscordCommandPublicationScope,
    lease: DiscordCommandPublicationLease,
    signal?: AbortSignal,
  ): Promise<DiscordCommandPublicationSnapshot | null> {
    return this.inner.loadSnapshot(claimedScope, lease, signal);
  }

  public async saveSnapshot(
    claimedScope: DiscordCommandPublicationScope,
    lease: DiscordCommandPublicationLease,
    snapshot: DiscordCommandPublicationSnapshot,
    signal?: AbortSignal,
  ): Promise<void> {
    this.saveCalls += 1;
    if (!this.failed && this.saveCalls === this.failAtSave) {
      this.failed = true;
      throw new Error("simulated durable checkpoint outage");
    }
    await this.inner.saveSnapshot(claimedScope, lease, snapshot, signal);
  }

  public releaseScope(
    claimedScope: DiscordCommandPublicationScope,
    lease: DiscordCommandPublicationLease,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.inner.releaseScope(claimedScope, lease, signal);
  }
}

describe("Discord command publisher", () => {
  it("creates incrementally and then leaves the owned provider id unchanged", async () => {
    const rest = new MemoryRest();
    rest.commands.set(
      "100000000000000003",
      Object.freeze({
        id: "100000000000000003",
        name: "help",
        kind: "user",
        fingerprint: null,
      }),
    );
    rest.commands.set(
      "100000000000000004",
      Object.freeze({
        id: "100000000000000004",
        name: "foreign",
        kind: "chat_input",
        fingerprint: "0".repeat(64),
      }),
    );
    const snapshots = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    const publisher = new DiscordCommandPublisher(rest, snapshots);

    const first = await publisher.publish(scope, [command()]);
    const second = await publisher.publish(scope, [command()]);

    assert.equal(first.diff.created.length, 1);
    assert.equal(second.status, "unchanged");
    assert.deepEqual(second.diff.unchanged, ["help.command"]);
    assert.equal(rest.creates, 1);
    assert.equal(rest.updates, 0);
    assert.equal(rest.deletes, 0);
    assert.equal(second.snapshot.commands.length, 1);
    assert.equal(rest.commands.get("100000000000000003")?.kind, "user");
    assert.equal(rest.commands.has("100000000000000004"), true);
  });

  it("updates by the owned id and deletes only after an explicit opt-in", async () => {
    const rest = new MemoryRest();
    const snapshots = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    const publisher = new DiscordCommandPublisher(rest, snapshots);
    const created = await publisher.publish(scope, [command()]);
    const ownedId = created.snapshot.commands[0]?.providerCommandId;
    assert.ok(ownedId);

    const renamed = await publisher.publish(scope, [command("help.command", "assist")]);
    assert.deepEqual(renamed.diff.updated, ["help.command"]);
    assert.equal(renamed.snapshot.commands[0]?.providerCommandId, ownedId);

    const retained = await publisher.publish(scope, []);
    assert.deepEqual(retained.diff.retained, ["help.command"]);
    assert.equal(rest.deletes, 0);
    assert.equal(rest.commands.has(ownedId), true);

    rest.commands.set(
      "100000000000000099",
      Object.freeze({
        id: "100000000000000099",
        name: "foreign-menu",
        kind: "message",
        fingerprint: null,
      }),
    );
    const deleted = await publisher.publish(scope, [], {
      deleteOwnedCommandsAbsentFromCatalog: true,
    });
    assert.deepEqual(deleted.diff.deleted, ["help.command"]);
    assert.equal(rest.commands.has(ownedId), false);
    assert.equal(rest.commands.has("100000000000000099"), true);
    assert.equal(rest.deletes, 1);
  });

  it("does not adopt, update or delete an unmanaged chat-input command by name", async () => {
    const rest = new MemoryRest();
    rest.commands.set(
      "100000000000000088",
      Object.freeze({
        id: "100000000000000088",
        name: "help",
        kind: "chat_input",
        fingerprint: "f".repeat(64),
      }),
    );
    const publisher = new DiscordCommandPublisher(
      rest,
      new InMemoryDiscordCommandPublicationSnapshotAdapter(),
    );

    await assert.rejects(
      publisher.publish(scope, [command()], { deleteOwnedCommandsAbsentFromCatalog: true }),
      /unmanaged/iu,
    );
    assert.equal(rest.creates + rest.updates + rest.deletes, 0);
    assert.equal(rest.commands.has("100000000000000088"), true);
  });

  it("recovers a create that succeeded remotely before its ownership checkpoint", async () => {
    const rest = new MemoryRest();
    const durable = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    const flaky = new FailOneCheckpointSnapshotPort(durable, 2);
    const publisher = new DiscordCommandPublisher(rest, flaky);

    await assert.rejects(publisher.publish(scope, [command()]), /checkpoint outage/iu);
    assert.equal(rest.creates, 1);

    const recovered = await publisher.publish(scope, [command()]);
    assert.deepEqual(recovered.diff.recovered, ["help.command"]);
    assert.equal(rest.creates, 1, "recovery must adopt only the command authorized by pending intent");
    assert.equal(recovered.snapshot.pending, null);
    assert.equal(recovered.snapshot.commands.length, 1);
  });

  it("recovers update and delete success without replaying either mutation", async () => {
    const updateRest = new MemoryRest();
    const updateDurable = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    await new DiscordCommandPublisher(updateRest, updateDurable).publish(scope, [command()]);
    const flakyUpdate = new FailOneCheckpointSnapshotPort(updateDurable, 2);
    const updatePublisher = new DiscordCommandPublisher(updateRest, flakyUpdate);
    await assert.rejects(
      updatePublisher.publish(scope, [command("help.command", "assist")]),
      /checkpoint outage/iu,
    );
    assert.equal(updateRest.updates, 1);
    const recoveredUpdate = await updatePublisher.publish(scope, [
      command("help.command", "assist"),
    ]);
    assert.deepEqual(recoveredUpdate.diff.recovered, ["help.command"]);
    assert.equal(updateRest.updates, 1);

    const deleteRest = new MemoryRest();
    const deleteDurable = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    await new DiscordCommandPublisher(deleteRest, deleteDurable).publish(scope, [command()]);
    const flakyDelete = new FailOneCheckpointSnapshotPort(deleteDurable, 2);
    const deletePublisher = new DiscordCommandPublisher(deleteRest, flakyDelete);
    await assert.rejects(
      deletePublisher.publish(scope, [], { deleteOwnedCommandsAbsentFromCatalog: true }),
      /checkpoint outage/iu,
    );
    assert.equal(deleteRest.deletes, 1);
    const recoveredDelete = await deletePublisher.publish(scope, [], {
      deleteOwnedCommandsAbsentFromCatalog: true,
    });
    assert.deepEqual(recoveredDelete.diff.recovered, ["help.command"]);
    assert.equal(deleteRest.deletes, 1);
    assert.equal(recoveredDelete.snapshot.commands.length, 0);
  });

  it("fails closed when the provider scope lease is already held", async () => {
    const rest = new MemoryRest();
    const snapshots = new InMemoryDiscordCommandPublicationSnapshotAdapter();
    const lease = await snapshots.claimScope(scope, 10_000);
    assert.ok(lease);
    const publisher = new DiscordCommandPublisher(rest, snapshots);

    await assert.rejects(
      publisher.publish(scope, [command()]),
      (error: unknown) => error instanceof DiscordCoreError && error.code === "DISCORD_CIRCUIT_OPEN",
    );
    assert.equal(rest.lists, 0);
    await snapshots.releaseScope(scope, lease);
  });

  it("propagates caller cancellation and enforces one total deadline", async () => {
    const rest = new MemoryRest();
    const publisher = new DiscordCommandPublisher(
      rest,
      new InMemoryDiscordCommandPublicationSnapshotAdapter(),
    );
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      publisher.publish(scope, [command()], { signal: cancelled.signal }),
      (error: unknown) => error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
    );
    assert.equal(rest.lists, 0);

    const waitingRest: DiscordApplicationCommandsRestPort = {
      listApplicationCommands: async (_claimedScope, signal) =>
        new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          void resolve;
        }),
      createApplicationCommand: async () => {
        throw new Error("unreachable");
      },
      updateApplicationCommand: async () => {
        throw new Error("unreachable");
      },
      deleteApplicationCommand: async () => {
        throw new Error("unreachable");
      },
    };
    await assert.rejects(
      new DiscordCommandPublisher(
        waitingRest,
        new InMemoryDiscordCommandPublicationSnapshotAdapter(),
      ).publish(scope, [command()], { timeoutMs: 5 }),
      (error: unknown) => error instanceof DiscordCoreError && error.code === "DISCORD_TIMEOUT",
    );
  });
});
