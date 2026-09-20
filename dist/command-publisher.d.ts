import { type ChatInputCommandPlan, type DiscordApplicationCommandBody } from "./command-model.js";
/**
 * Publication owns individual provider command ids. It never assumes that an
 * application/guild collection is exclusively owned by one bot process.
 */
export type DiscordCommandPublicationScope = Readonly<{
    kind: "global";
    ownership: "provider_command_id";
    ownerKey: string;
    applicationId: string;
}> | Readonly<{
    kind: "guild";
    ownership: "provider_command_id";
    ownerKey: string;
    applicationId: string;
    guildId: string;
}>;
export type DiscordRemoteApplicationCommand = Readonly<{
    id: string;
    name: string;
    kind: "chat_input" | "user" | "message" | "unknown";
    /** Present only for a normalized chat-input command. */
    fingerprint: string | null;
}>;
export interface DiscordApplicationCommandsRestPort {
    listApplicationCommands(scope: DiscordCommandPublicationScope, signal?: AbortSignal): Promise<readonly DiscordRemoteApplicationCommand[]>;
    createApplicationCommand(scope: DiscordCommandPublicationScope, command: DiscordApplicationCommandBody, signal?: AbortSignal): Promise<DiscordRemoteApplicationCommand>;
    updateApplicationCommand(scope: DiscordCommandPublicationScope, providerCommandId: string, command: DiscordApplicationCommandBody, signal?: AbortSignal): Promise<DiscordRemoteApplicationCommand>;
    deleteApplicationCommand(scope: DiscordCommandPublicationScope, providerCommandId: string, signal?: AbortSignal): Promise<"deleted" | "already_absent">;
}
export type DiscordCommandSnapshotEntry = Readonly<{
    key: string;
    commandName: string;
    fingerprint: string;
    providerCommandId: string;
}>;
type DiscordPendingCommandTarget = Readonly<{
    key: string;
    commandName: string;
    fingerprint: string;
    body: DiscordApplicationCommandBody;
}>;
export type DiscordCommandPublicationPendingOperation = Readonly<{
    kind: "create";
    target: DiscordPendingCommandTarget;
}> | Readonly<{
    kind: "update";
    providerCommandId: string;
    target: DiscordPendingCommandTarget;
}> | Readonly<{
    kind: "delete";
    entry: DiscordCommandSnapshotEntry;
}>;
export type DiscordCommandPublicationSnapshot = Readonly<{
    schemaVersion: 5;
    revision: number;
    ownerKey: string;
    scopeKind: DiscordCommandPublicationScope["kind"];
    applicationId: string;
    guildId: string | null;
    /** Fingerprint of the last fully reconciled desired catalog (not retained commands). */
    catalogFingerprint: string;
    /** The complete set of provider command ids owned by this publisher. */
    commands: readonly DiscordCommandSnapshotEntry[];
    /** Durable write-ahead intent used to recover a provider-success/storage-failure window. */
    pending: DiscordCommandPublicationPendingOperation | null;
}>;
export type DiscordCommandPublicationLease = Readonly<{
    leaseId: string;
    providerScopeKey: string;
    expiresAtEpochMs: number;
}>;
export interface DiscordCommandPublicationSnapshotPort {
    /** Atomically claims the whole provider scope, across all logical owners. */
    claimScope(scope: DiscordCommandPublicationScope, durationMs: number, signal?: AbortSignal): Promise<DiscordCommandPublicationLease | null>;
    loadSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<DiscordCommandPublicationSnapshot | null>;
    saveSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, snapshot: DiscordCommandPublicationSnapshot, signal?: AbortSignal): Promise<void>;
    releaseScope(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<void>;
}
export type DiscordCommandPublicationDiff = Readonly<{
    created: readonly string[];
    updated: readonly string[];
    deleted: readonly string[];
    retained: readonly string[];
    unchanged: readonly string[];
    recovered: readonly string[];
}>;
export type DiscordCommandPublicationResult = Readonly<{
    status: "published" | "unchanged";
    diff: DiscordCommandPublicationDiff;
    snapshot: DiscordCommandPublicationSnapshot;
}>;
export type DiscordCommandPublicationOptions = Readonly<{
    signal?: AbortSignal;
    timeoutMs?: number;
    deadlineEpochMs?: number;
    /** Destructive reconciliation is disabled unless this literal opt-in is present. */
    deleteOwnedCommandsAbsentFromCatalog?: true;
}>;
export declare const fingerprintDiscordCommand: (value: unknown) => string;
/** Normalizes provider defaults before comparing a remote chat-input command. */
export declare const fingerprintDiscordChatInputCommand: (value: unknown, placement: DiscordCommandPublicationScope["kind"]) => string;
declare const assertSnapshotIntegrity: (snapshot: DiscordCommandPublicationSnapshot, scope: DiscordCommandPublicationScope) => void;
export declare class DiscordCommandPublisher {
    private readonly rest;
    private readonly snapshots;
    constructor(rest: DiscordApplicationCommandsRestPort, snapshots: DiscordCommandPublicationSnapshotPort);
    publish(requestedScope: DiscordCommandPublicationScope, commands: readonly ChatInputCommandPlan[], options?: DiscordCommandPublicationOptions): Promise<DiscordCommandPublicationResult>;
}
export declare class InMemoryDiscordCommandPublicationSnapshotAdapter implements DiscordCommandPublicationSnapshotPort {
    private readonly snapshots;
    private readonly leases;
    claimScope(scope: DiscordCommandPublicationScope, durationMs: number, signal?: AbortSignal): Promise<DiscordCommandPublicationLease | null>;
    loadSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<DiscordCommandPublicationSnapshot | null>;
    saveSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, snapshot: DiscordCommandPublicationSnapshot, signal?: AbortSignal): Promise<void>;
    releaseScope(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<void>;
    values(): readonly DiscordCommandPublicationSnapshot[];
    private assertLease;
}
export declare const assertDiscordCommandPublicationSnapshot: typeof assertSnapshotIntegrity;
export {};
//# sourceMappingURL=command-publisher.d.ts.map