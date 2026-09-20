import { type DiscordApplicationCommandsRestPort, type DiscordCommandPublicationScope, type DiscordCommandPublicationSnapshotPort } from "./command-publisher.js";
export interface DiscordKnownCommandOwnership {
    readonly key: string;
    readonly commandName: string;
    /** Explicit fingerprints of catalog versions previously managed by this consumer. */
    readonly fingerprints: readonly string[];
}
/** One-time import of verified legacy ownership. A name match alone never grants ownership. */
export declare const bootstrapDiscordCommandOwnership: (scope: DiscordCommandPublicationScope, known: readonly DiscordKnownCommandOwnership[], rest: DiscordApplicationCommandsRestPort, store: DiscordCommandPublicationSnapshotPort, signal?: AbortSignal) => Promise<void>;
//# sourceMappingURL=command-ownership.d.ts.map