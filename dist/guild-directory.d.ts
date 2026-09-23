export type DiscordGuildPermission = "administrator" | "manage_guild" | "manage_roles" | "moderate_members" | "ban_members" | "kick_members";
export type DiscordGuildRoleSnapshot = Readonly<{
    guildId: string;
    id: string;
    name: string;
    colorValue: number;
    position: number;
    managed: boolean;
    everyone: boolean;
    editable: boolean;
    permissions: readonly DiscordGuildPermission[];
}>;
export type DiscordGuildMemberSnapshot = Readonly<{
    guildId: string;
    userId: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
    nickname: string | null;
    joinedAt: string | null;
    bot: boolean;
    roleIds: readonly string[];
    /** Live voice membership, when the provider supports voice state reads. */
    voiceChannelId?: string | null;
}>;
export type DiscordGuildMemberPage = Readonly<{
    guildId: string;
    limit: number;
    after: string | null;
    members: readonly DiscordGuildMemberSnapshot[];
    nextAfter: string | null;
}>;
export type DiscordGuildRoleListInput = Readonly<{
    guildId: string;
    signal?: AbortSignal;
}>;
export type DiscordGuildMemberListInput = Readonly<{
    guildId: string;
    limit: number;
    after?: string;
    signal?: AbortSignal;
}>;
/** Provider-neutral, bounded directory reads for one Discord guild. */
export interface DiscordGuildDirectoryPort {
    listRoles(input: DiscordGuildRoleListInput): Promise<readonly DiscordGuildRoleSnapshot[]>;
    listMembers(input: DiscordGuildMemberListInput): Promise<DiscordGuildMemberPage>;
}
//# sourceMappingURL=guild-directory.d.ts.map