import type { DiscordGuildRoleSnapshot } from "./guild-directory.js";
export type DiscordCreateStandardRoleInput = Readonly<{
    guildId: string;
    name: string;
    auditReason: string;
    signal?: AbortSignal;
    deadlineEpochMs?: number;
}>;
export interface DiscordGuildRoleManagementPort {
    /** Creates a non-privileged role with no explicit permissions; never retries an uncertain creation. */
    createStandardRole(input: DiscordCreateStandardRoleInput): Promise<DiscordGuildRoleSnapshot>;
}
//# sourceMappingURL=guild-role-management.d.ts.map