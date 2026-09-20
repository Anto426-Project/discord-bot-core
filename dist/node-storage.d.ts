import type { DiscordCommandPublicationLease, DiscordCommandPublicationScope, DiscordCommandPublicationSnapshot, DiscordCommandPublicationSnapshotPort } from "./command-publisher.js";
/** Durable command ownership, with an atomic lease shared by processes using this database. */
export declare class SqliteDiscordCommandPublicationSnapshotAdapter implements DiscordCommandPublicationSnapshotPort {
    private readonly now;
    private readonly database;
    constructor(filename: string, now?: () => number);
    close(): void;
    claimScope(scope: DiscordCommandPublicationScope, durationMs: number, signal?: AbortSignal): Promise<DiscordCommandPublicationLease | null>;
    loadSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, signal?: AbortSignal): Promise<DiscordCommandPublicationSnapshot | null>;
    saveSnapshot(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, snapshot: DiscordCommandPublicationSnapshot, signal?: AbortSignal): Promise<void>;
    releaseScope(scope: DiscordCommandPublicationScope, lease: DiscordCommandPublicationLease, _signal?: AbortSignal): Promise<void>;
    private assertLease;
}
//# sourceMappingURL=node-storage.d.ts.map