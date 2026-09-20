import { createHash, randomUUID } from "node:crypto";
import { toDiscordApplicationCommand, } from "./command-model.js";
import { DiscordCoreError } from "./errors.js";
import { parseDiscordSnowflake, parseStableBotKey } from "./identifiers.js";
const MAX_COMMANDS_PER_CATALOG = 100;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const LEASE_SAFETY_MARGIN_MS = 5_000;
const invalid = (summary) => {
    throw new DiscordCoreError("DISCORD_INVALID_INPUT", summary, false);
};
const canonicalize = (value, depth = 0) => {
    if (depth > 12)
        return invalid("Discord command payload nesting is invalid.");
    if (Array.isArray(value)) {
        if (value.length > 10_000)
            invalid("Discord command payload collection is too large.");
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (descriptor === undefined)
                return invalid("Discord command payload contains an unsafe collection.");
            if (!("value" in descriptor))
                return invalid("Discord command payload contains an unsafe collection.");
            result.push(canonicalize(descriptor.value, depth + 1));
        }
        return result;
    }
    if (value !== null && typeof value === "object") {
        const result = {};
        const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
        if (keys.length > 1_000)
            invalid("Discord command payload object is too large.");
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (descriptor === undefined)
                return invalid("Discord command payload contains an unsafe property.");
            if (!("value" in descriptor))
                return invalid("Discord command payload contains an unsafe property.");
            if (descriptor.value !== undefined)
                result[key] = canonicalize(descriptor.value, depth + 1);
        }
        return result;
    }
    if (value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        typeof value === "string") {
        return value;
    }
    return invalid("Discord command payload contains an unsupported value.");
};
export const fingerprintDiscordCommand = (value) => createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
const recordValue = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : Object.freeze({});
const ownDataValue = (record, key) => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined)
        return undefined;
    if (!("value" in descriptor))
        invalid("Discord command payload contains an unsafe property.");
    return descriptor.value;
};
const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const denseArrayValues = (value, maximum, label) => {
    if (!Array.isArray(value))
        return Object.freeze([]);
    if (value.length > maximum)
        invalid(`${label} exceeds its provider limit.`);
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined)
            return invalid(`${label} contains an unsafe collection entry.`);
        if (!("value" in descriptor))
            return invalid(`${label} contains an unsafe collection entry.`);
        result.push(descriptor.value);
    }
    return Object.freeze(result);
};
const localizationMap = (value) => {
    const record = recordValue(value);
    const entries = [];
    const keys = Object.keys(record);
    if (keys.length > 100)
        invalid("Discord command localization map is too large.");
    for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        if (descriptor === undefined) {
            return invalid("Discord command localization map contains an unsafe property.");
        }
        if (!("value" in descriptor)) {
            return invalid("Discord command localization map contains an unsafe property.");
        }
        if (typeof descriptor.value === "string")
            entries.push([key, descriptor.value]);
    }
    return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
};
const numericList = (value) => {
    const result = [];
    for (const entry of denseArrayValues(value, 20, "Discord command numeric list")) {
        if (typeof entry === "number" && Number.isFinite(entry))
            result.push(entry);
    }
    return Object.freeze(result.sort((left, right) => left - right));
};
const normalizedChoice = (value) => {
    const choice = recordValue(value);
    const name = ownDataValue(choice, "name");
    const choiceValue = ownDataValue(choice, "value");
    return {
        name: typeof name === "string" ? name : "",
        name_localizations: localizationMap(ownDataValue(choice, "name_localizations")),
        value: typeof choiceValue === "string" || typeof choiceValue === "number"
            ? choiceValue
            : "",
    };
};
const normalizedOption = (value, depth = 0) => {
    if (depth > 3)
        invalid("Discord command option nesting is invalid.");
    const option = recordValue(value);
    const type = finiteNumber(ownDataValue(option, "type")) ?? 0;
    const nested = denseArrayValues(ownDataValue(option, "options"), 25, "Discord nested command options").map((entry) => normalizedOption(entry, depth + 1));
    const choices = denseArrayValues(ownDataValue(option, "choices"), 25, "Discord command choices").map(normalizedChoice);
    const channelTypes = numericList(ownDataValue(option, "channel_types"));
    const name = ownDataValue(option, "name");
    const description = ownDataValue(option, "description");
    const required = ownDataValue(option, "required");
    const autocomplete = ownDataValue(option, "autocomplete");
    const minValue = ownDataValue(option, "min_value");
    const maxValue = ownDataValue(option, "max_value");
    const minLength = ownDataValue(option, "min_length");
    const maxLength = ownDataValue(option, "max_length");
    return {
        type,
        name: typeof name === "string" ? name : "",
        name_localizations: localizationMap(ownDataValue(option, "name_localizations")),
        description: typeof description === "string" ? description : "",
        description_localizations: localizationMap(ownDataValue(option, "description_localizations")),
        ...(type === 1 || type === 2
            ? { options: nested }
            : { required: required === true }),
        ...(type === 3 || type === 4 || type === 10
            ? { autocomplete: autocomplete === true }
            : {}),
        ...(choices.length === 0 ? {} : { choices }),
        ...(channelTypes.length === 0 ? {} : { channel_types: channelTypes }),
        ...(finiteNumber(minValue) === undefined ? {} : { min_value: minValue }),
        ...(finiteNumber(maxValue) === undefined ? {} : { max_value: maxValue }),
        ...(finiteNumber(minLength) === undefined ? {} : { min_length: minLength }),
        ...(finiteNumber(maxLength) === undefined ? {} : { max_length: maxLength }),
    };
};
/** Normalizes provider defaults before comparing a remote chat-input command. */
export const fingerprintDiscordChatInputCommand = (value, placement) => {
    const command = recordValue(value);
    const options = denseArrayValues(ownDataValue(command, "options"), 25, "Discord command options").map((entry) => normalizedOption(entry));
    const type = ownDataValue(command, "type");
    const name = ownDataValue(command, "name");
    const description = ownDataValue(command, "description");
    const permissions = ownDataValue(command, "default_member_permissions");
    const common = {
        type: finiteNumber(type) ?? 1,
        name: typeof name === "string" ? name : "",
        name_localizations: localizationMap(ownDataValue(command, "name_localizations")),
        description: typeof description === "string" ? description : "",
        description_localizations: localizationMap(ownDataValue(command, "description_localizations")),
        options,
        default_member_permissions: permissions === null ||
            permissions === undefined
            ? null
            : String(permissions),
        nsfw: ownDataValue(command, "nsfw") === true,
    };
    return fingerprintDiscordCommand(placement === "global"
        ? {
            ...common,
            dm_permission: ownDataValue(command, "dm_permission") !== false,
            contexts: numericList(ownDataValue(command, "contexts")),
            integration_types: numericList(ownDataValue(command, "integration_types")),
        }
        : common);
};
const providerScopeKey = (scope) => scope.kind === "global"
    ? `${scope.applicationId}:global`
    : `${scope.applicationId}:guild:${scope.guildId}`;
const ownerSnapshotKey = (scope) => `${scope.ownerKey}:${providerScopeKey(scope)}`;
const normalizeScope = (scope) => {
    if (scope.ownership !== "provider_command_id") {
        invalid("Discord command publication requires provider-command-id ownership.");
    }
    const common = {
        ownership: "provider_command_id",
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
const prepareCommands = (scope, commands) => {
    if (commands.length > MAX_COMMANDS_PER_CATALOG) {
        invalid("Discord command catalog exceeds the scope limit.");
    }
    const keys = new Set();
    const names = new Set();
    return Object.freeze(commands
        .map((command) => {
        const key = parseStableBotKey(command.key, "command key");
        if (keys.has(key) || names.has(command.name.en)) {
            invalid("Discord command keys and names must be unique.");
        }
        keys.add(key);
        names.add(command.name.en);
        const body = toDiscordApplicationCommand(command, scope.kind);
        return Object.freeze({
            key,
            body,
            fingerprint: fingerprintDiscordChatInputCommand(body, scope.kind),
        });
    })
        .sort((left, right) => left.key.localeCompare(right.key)));
};
const targetOf = (command) => Object.freeze({
    key: command.key,
    commandName: command.body.name,
    fingerprint: command.fingerprint,
    body: command.body,
});
const emptySnapshot = (scope) => Object.freeze({
    schemaVersion: 5,
    revision: 0,
    ownerKey: scope.ownerKey,
    scopeKind: scope.kind,
    applicationId: scope.applicationId,
    guildId: scope.kind === "guild" ? scope.guildId : null,
    catalogFingerprint: fingerprintDiscordCommand([]),
    commands: Object.freeze([]),
    pending: null,
});
const snapshotMatchesScope = (snapshot, scope) => snapshot.schemaVersion === 5 &&
    snapshot.ownerKey === scope.ownerKey &&
    snapshot.scopeKind === scope.kind &&
    snapshot.applicationId === scope.applicationId &&
    snapshot.guildId === (scope.kind === "guild" ? scope.guildId : null);
const assertSnapshotIntegrity = (snapshot, scope) => {
    if (!snapshotMatchesScope(snapshot, scope) || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
        invalid("Discord command publication snapshot is invalid for this scope.");
    }
    const keys = new Set();
    const ids = new Set();
    for (const entry of snapshot.commands) {
        const key = parseStableBotKey(entry.key, "snapshot command key");
        const id = parseDiscordSnowflake(entry.providerCommandId, "snapshot provider command id");
        if (entry.commandName.length < 1 || entry.commandName.length > 32 || keys.has(key) || ids.has(id)) {
            invalid("Discord command publication snapshot contains duplicate or malformed ownership.");
        }
        if (!/^[a-f0-9]{64}$/u.test(entry.fingerprint)) {
            invalid("Discord command publication snapshot fingerprint is invalid.");
        }
        keys.add(key);
        ids.add(id);
    }
    const pending = snapshot.pending;
    if (pending?.kind === "create" || pending?.kind === "update") {
        parseStableBotKey(pending.target.key, "pending command key");
        if (pending.target.commandName !== pending.target.body.name ||
            pending.target.fingerprint !== fingerprintDiscordChatInputCommand(pending.target.body, scope.kind)) {
            invalid("Discord command publication intent target is malformed.");
        }
    }
    if (pending?.kind === "update") {
        const entry = snapshot.commands.find((candidate) => candidate.key === pending.target.key);
        if (entry?.providerCommandId !== pending.providerCommandId) {
            invalid("Discord command update intent does not match owned provider state.");
        }
    }
    if (pending?.kind === "delete") {
        const entry = snapshot.commands.find((candidate) => candidate.key === pending.entry.key);
        if (entry?.providerCommandId !== pending.entry.providerCommandId) {
            invalid("Discord command delete intent does not match owned provider state.");
        }
    }
};
const normalizeRemoteCommands = (commands) => {
    if (commands.length > 200) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord returned too many application commands.", false);
    }
    const result = new Map();
    const typedNames = new Set();
    for (const command of commands) {
        const id = parseDiscordSnowflake(command.id, "remote Discord command id");
        const name = command.name.trim();
        const typedName = `${command.kind}:${name}`;
        if (name.length < 1 ||
            name.length > 32 ||
            result.has(id) ||
            typedNames.has(typedName) ||
            (command.kind === "chat_input" && !/^[a-f0-9]{64}$/u.test(command.fingerprint ?? "")) ||
            (command.kind !== "chat_input" && command.fingerprint !== null)) {
            throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord returned duplicate or malformed application commands.", false);
        }
        typedNames.add(typedName);
        result.set(id, Object.freeze({ ...command, id, name }));
    }
    return result;
};
const remoteChatByName = (remote, name) => [...remote.values()].find((command) => command.kind === "chat_input" && command.name === name);
const assertChatReceipt = (receipt, target, expectedId) => {
    const id = parseDiscordSnowflake(receipt.id, "Discord command receipt id");
    if (receipt.kind !== "chat_input" ||
        receipt.name !== target.commandName ||
        receipt.fingerprint !== target.fingerprint ||
        (expectedId !== undefined && id !== expectedId)) {
        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord command mutation receipt does not match the requested command.", false);
    }
    return Object.freeze({ ...receipt, id });
};
const snapshotEntry = (target, providerCommandId) => Object.freeze({
    key: target.key,
    commandName: target.commandName,
    fingerprint: target.fingerprint,
    providerCommandId,
});
const replaceEntry = (entries, entry) => Object.freeze([...entries.filter((candidate) => candidate.key !== entry.key), entry].sort((left, right) => left.key.localeCompare(right.key)));
const withoutEntry = (entries, key) => Object.freeze(entries.filter((entry) => entry.key !== key));
const nextSnapshot = (snapshot, change) => Object.freeze({
    ...snapshot,
    ...change,
    schemaVersion: 5,
    revision: snapshot.revision + 1,
});
const publicationTimeout = (options, now) => {
    if (options.timeoutMs !== undefined && options.deadlineEpochMs !== undefined) {
        invalid("Discord command publication accepts either timeoutMs or deadlineEpochMs, not both.");
    }
    const timeout = options.deadlineEpochMs === undefined
        ? (options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
        : options.deadlineEpochMs - now;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
        invalid(`Discord command publication deadline must be within ${MAX_TIMEOUT_MS} milliseconds.`);
    }
    return timeout;
};
const abortFailure = (callerSignal) => callerSignal?.aborted === true
    ? new DiscordCoreError("DISCORD_CANCELLED", "Discord command publication was cancelled.", false)
    : new DiscordCoreError("DISCORD_TIMEOUT", "Discord command publication exceeded its deadline.", true);
export class DiscordCommandPublisher {
    rest;
    snapshots;
    constructor(rest, snapshots) {
        this.rest = rest;
        this.snapshots = snapshots;
    }
    async publish(requestedScope, commands, options = {}) {
        if (options.signal?.aborted === true)
            throw abortFailure(options.signal);
        const scope = normalizeScope(requestedScope);
        const prepared = prepareCommands(scope, commands);
        const startedAtEpochMs = Date.now();
        const timeoutMs = publicationTimeout(options, startedAtEpochMs);
        const deadlineEpochMs = startedAtEpochMs + timeoutMs;
        const controller = new AbortController();
        const onCallerAbort = () => controller.abort();
        options.signal?.addEventListener("abort", onCallerAbort, { once: true });
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const signal = controller.signal;
        let lease = null;
        try {
            lease = await this.snapshots.claimScope(scope, timeoutMs + LEASE_SAFETY_MARGIN_MS, signal);
            if (lease === null) {
                throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord command publication scope is already being reconciled.", true);
            }
            if (lease.providerScopeKey !== providerScopeKey(scope) ||
                lease.leaseId.length < 1 ||
                lease.leaseId.length > 200 ||
                /[\u0000-\u001f\u007f]/u.test(lease.leaseId) ||
                !Number.isSafeInteger(lease.expiresAtEpochMs) ||
                lease.expiresAtEpochMs < deadlineEpochMs) {
                throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Discord command publication lease is malformed or too short for the deadline.", false);
            }
            let snapshot = (await this.snapshots.loadSnapshot(scope, lease, signal)) ?? emptySnapshot(scope);
            assertSnapshotIntegrity(snapshot, scope);
            const remote = normalizeRemoteCommands(await this.rest.listApplicationCommands(scope, signal));
            const recovered = [];
            const checkpoint = async (next) => {
                assertSnapshotIntegrity(next, scope);
                await this.snapshots.saveSnapshot(scope, lease, next, signal);
                return next;
            };
            const completeCreate = async (current, target) => {
                let receipt = remoteChatByName(remote, target.commandName);
                if (receipt === undefined) {
                    receipt = assertChatReceipt(await this.rest.createApplicationCommand(scope, target.body, signal), target);
                }
                else if (receipt.fingerprint !== target.fingerprint) {
                    throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "An unmanaged Discord chat-input command already uses the desired name.", false);
                }
                const verified = assertChatReceipt(receipt, target);
                const duplicateOwner = current.commands.find((entry) => entry.providerCommandId === verified.id && entry.key !== target.key);
                if (duplicateOwner !== undefined) {
                    invalid("Discord command receipt collides with another owned provider command id.");
                }
                remote.set(verified.id, verified);
                return checkpoint(nextSnapshot(current, {
                    commands: replaceEntry(current.commands, snapshotEntry(target, verified.id)),
                    pending: null,
                }));
            };
            const completeUpdate = async (current, providerCommandId, target) => {
                const existing = remote.get(providerCommandId);
                if (existing === undefined) {
                    const collision = remoteChatByName(remote, target.commandName);
                    if (collision !== undefined) {
                        throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "An unmanaged Discord chat-input command already uses the desired name.", false);
                    }
                    const createIntent = nextSnapshot(current, {
                        pending: Object.freeze({ kind: "create", target }),
                    });
                    return completeCreate(await checkpoint(createIntent), target);
                }
                if (existing.kind !== "chat_input") {
                    throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "An owned Discord provider id no longer identifies a chat-input command.", false);
                }
                const nameCollision = remoteChatByName(remote, target.commandName);
                if (nameCollision !== undefined && nameCollision.id !== providerCommandId) {
                    throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "An unmanaged Discord chat-input command already uses the desired name.", false);
                }
                const receipt = existing.name === target.commandName && existing.fingerprint === target.fingerprint
                    ? existing
                    : assertChatReceipt(await this.rest.updateApplicationCommand(scope, providerCommandId, target.body, signal), target, providerCommandId);
                const verified = assertChatReceipt(receipt, target, providerCommandId);
                remote.set(providerCommandId, verified);
                return checkpoint(nextSnapshot(current, {
                    commands: replaceEntry(current.commands, snapshotEntry(target, providerCommandId)),
                    pending: null,
                }));
            };
            const completeDelete = async (current, entry) => {
                const existing = remote.get(entry.providerCommandId);
                if (existing !== undefined) {
                    if (existing.kind !== "chat_input") {
                        throw new DiscordCoreError("DISCORD_RESPONSE_INVALID", "Refusing to delete a non-chat-input Discord provider command.", false);
                    }
                    await this.rest.deleteApplicationCommand(scope, entry.providerCommandId, signal);
                    remote.delete(entry.providerCommandId);
                }
                return checkpoint(nextSnapshot(current, {
                    commands: withoutEntry(current.commands, entry.key),
                    pending: null,
                }));
            };
            if (snapshot.pending !== null) {
                const pending = snapshot.pending;
                switch (pending.kind) {
                    case "create":
                        snapshot = await completeCreate(snapshot, pending.target);
                        recovered.push(pending.target.key);
                        break;
                    case "update":
                        snapshot = await completeUpdate(snapshot, pending.providerCommandId, pending.target);
                        recovered.push(pending.target.key);
                        break;
                    case "delete":
                        snapshot = await completeDelete(snapshot, pending.entry);
                        recovered.push(pending.entry.key);
                        break;
                }
            }
            const created = [];
            const updated = [];
            const deleted = [];
            const retained = [];
            const unchanged = [];
            for (const desired of prepared) {
                const target = targetOf(desired);
                const owned = snapshot.commands.find((entry) => entry.key === desired.key);
                if (owned === undefined) {
                    if (remoteChatByName(remote, target.commandName) !== undefined) {
                        throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "An unmanaged Discord chat-input command already uses the desired name.", false);
                    }
                    snapshot = await checkpoint(nextSnapshot(snapshot, {
                        pending: Object.freeze({ kind: "create", target }),
                    }));
                    snapshot = await completeCreate(snapshot, target);
                    created.push(desired.key);
                    continue;
                }
                const existing = remote.get(owned.providerCommandId);
                if (existing?.kind === "chat_input" &&
                    existing.name === target.commandName &&
                    existing.fingerprint === target.fingerprint) {
                    if (owned.commandName !== target.commandName || owned.fingerprint !== target.fingerprint) {
                        snapshot = await checkpoint(nextSnapshot(snapshot, {
                            commands: replaceEntry(snapshot.commands, snapshotEntry(target, owned.providerCommandId)),
                        }));
                    }
                    unchanged.push(desired.key);
                    continue;
                }
                if (existing === undefined && remoteChatByName(remote, target.commandName) !== undefined) {
                    throw new DiscordCoreError("DISCORD_PROVIDER_FAILURE", "An unmanaged Discord chat-input command already uses the desired name.", false);
                }
                snapshot = await checkpoint(nextSnapshot(snapshot, {
                    pending: Object.freeze({
                        kind: "update",
                        providerCommandId: owned.providerCommandId,
                        target,
                    }),
                }));
                snapshot = await completeUpdate(snapshot, owned.providerCommandId, target);
                updated.push(desired.key);
            }
            const desiredKeys = new Set(prepared.map((command) => command.key));
            for (const owned of [...snapshot.commands]) {
                if (desiredKeys.has(owned.key))
                    continue;
                if (options.deleteOwnedCommandsAbsentFromCatalog !== true) {
                    retained.push(owned.key);
                    continue;
                }
                snapshot = await checkpoint(nextSnapshot(snapshot, {
                    pending: Object.freeze({ kind: "delete", entry: owned }),
                }));
                snapshot = await completeDelete(snapshot, owned);
                deleted.push(owned.key);
            }
            const catalogFingerprint = fingerprintDiscordCommand(prepared.map(({ key, fingerprint }) => ({ key, fingerprint })));
            if (snapshot.catalogFingerprint !== catalogFingerprint) {
                snapshot = await checkpoint(nextSnapshot(snapshot, { catalogFingerprint }));
            }
            const diff = Object.freeze({
                created: Object.freeze(created),
                updated: Object.freeze(updated),
                deleted: Object.freeze(deleted),
                retained: Object.freeze(retained),
                unchanged: Object.freeze(unchanged),
                recovered: Object.freeze(recovered),
            });
            return Object.freeze({
                status: created.length + updated.length + deleted.length + recovered.length > 0
                    ? "published"
                    : "unchanged",
                diff,
                snapshot,
            });
        }
        catch (error) {
            if (signal.aborted)
                throw abortFailure(options.signal);
            throw error;
        }
        finally {
            if (lease !== null) {
                try {
                    await this.snapshots.releaseScope(scope, lease, signal);
                }
                catch {
                    // A failed release is safe: the bounded durable lease expires. Never
                    // mask the publication result with cleanup-provider details.
                }
            }
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", onCallerAbort);
        }
    }
}
const cloneSnapshot = (snapshot) => structuredClone(snapshot);
export class InMemoryDiscordCommandPublicationSnapshotAdapter {
    snapshots = new Map();
    leases = new Map();
    async claimScope(scope, durationMs, signal) {
        if (signal?.aborted === true)
            throw abortFailure(signal);
        if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > MAX_TIMEOUT_MS + 10_000) {
            invalid("Discord command publication lease duration is invalid.");
        }
        const key = providerScopeKey(scope);
        const now = Date.now();
        const current = this.leases.get(key);
        if (current !== undefined && current.expiresAtEpochMs > now)
            return null;
        const lease = Object.freeze({
            leaseId: randomUUID(),
            providerScopeKey: key,
            expiresAtEpochMs: now + durationMs,
        });
        this.leases.set(key, lease);
        return lease;
    }
    async loadSnapshot(scope, lease, signal) {
        this.assertLease(scope, lease, signal);
        const snapshot = this.snapshots.get(ownerSnapshotKey(scope));
        return snapshot === undefined ? null : cloneSnapshot(snapshot);
    }
    async saveSnapshot(scope, lease, snapshot, signal) {
        this.assertLease(scope, lease, signal);
        assertSnapshotIntegrity(snapshot, scope);
        this.snapshots.set(ownerSnapshotKey(scope), cloneSnapshot(snapshot));
    }
    async releaseScope(scope, lease, signal) {
        if (signal?.aborted === true)
            return;
        const key = providerScopeKey(scope);
        if (this.leases.get(key)?.leaseId === lease.leaseId)
            this.leases.delete(key);
    }
    values() {
        return Object.freeze([...this.snapshots.values()].map(cloneSnapshot));
    }
    assertLease(scope, lease, signal) {
        if (signal?.aborted === true)
            throw abortFailure(signal);
        const key = providerScopeKey(scope);
        const current = this.leases.get(key);
        if (current?.leaseId !== lease.leaseId ||
            lease.providerScopeKey !== key ||
            current.expiresAtEpochMs <= Date.now()) {
            throw new DiscordCoreError("DISCORD_CIRCUIT_OPEN", "Discord command publication lease is missing or expired.", true);
        }
    }
}
export const assertDiscordCommandPublicationSnapshot = assertSnapshotIntegrity;
//# sourceMappingURL=command-publisher.js.map