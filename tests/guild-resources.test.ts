import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ChannelType,
  Client,
  Collection,
  Events,
  PermissionFlagsBits,
} from "discord.js";

import { DiscordCoreError } from "../src/errors.js";
import { createNodeDiscordRuntime } from "../src/discordjs.js";

const TOKEN = "guild-resource-provider-token-with-enough-length";
const BOT_ID = "12345678901234567";
const APP_ID = "22345678901234567";
const GUILD_ID = "32345678901234567";
const USER_ID = "42345678901234567";
const CHANNEL_ID = "52345678901234567";
const ROLE_ID = "62345678901234567";
const MANAGED_ROLE_ID = "72345678901234567";
const HIGH_ROLE_ID = "82345678901234567";
const TIMEOUT_ROLE_ID = "92345678901234567";
const MEMBER_BASE_ROLE_ID = "13345678901234567";
const BOT_ROLE_ID = "23345678901234567";
const MISSING_ID = "93345678901234567";
const OWNER_ID = "14345678901234567";

type MutableTestClient = Client & { __testReady?: boolean };

const providerNotFound = (): Error & { status: number; code: number } =>
  Object.assign(new Error("provider detail must remain private"), {
    status: 404,
    code: 10_007,
  });

const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("provider-neutral Discord guild resources", () => {
  it("reads live closed facts and safely reconciles single-role effects", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);

    let providerClient: MutableTestClient | null = null;
    let providerGuild: Record<string, unknown> | null = null;
    let providerTargetRole: Record<string, unknown> | null = null;
    let canManageRoles = true;
    let targetHighestPosition = 1;
    let targetRoleEditable = true;
    let holdNextAdd = false;
    let resolveHeldAdd: (() => void) | null = null;
    let notifyAddStarted: (() => void) | null = null;
    const addStarted = (): Promise<void> =>
      new Promise((resolve) => {
        notifyAddStarted = resolve;
      });
    const records = {
      roleFetches: 0,
      memberFetches: 0,
      channelFetches: 0,
      adds: [] as Readonly<{ roleId: string; reason: string }>[],
      removes: [] as Readonly<{ roleId: string; reason: string }>[],
    };

    Object.defineProperty(Client.prototype, "isReady", {
      ...readyDescriptor,
      value(this: MutableTestClient): boolean {
        return this.__testReady === true;
      },
    });
    Object.defineProperty(Client.prototype, "login", {
      ...loginDescriptor,
      async value(this: MutableTestClient): Promise<string> {
        providerClient = this;
        (this as unknown as { user: unknown }).user = {
          id: BOT_ID,
          username: "core-bot",
          displayName: "Core Bot",
        };
        (this as unknown as { application: unknown }).application = { id: APP_ID };

        const guild: Record<string, unknown> = {};
        providerGuild = guild;
        const createRole = (
          id: string,
          name: string,
          position: number,
          managed: boolean,
          editable: boolean | (() => boolean),
        ): Record<string, unknown> => ({
          id,
          guild,
          name,
          color: 0,
          position,
          managed,
          get editable(): boolean {
            return typeof editable === "function" ? editable() : editable;
          },
          permissions: { has: () => false },
        });
        const everyoneRole = createRole(GUILD_ID, "@everyone", 0, false, false);
        const memberBaseRole = createRole(MEMBER_BASE_ROLE_ID, "Member", 1, false, true);
        const botRole = createRole(BOT_ROLE_ID, "Core", 10, false, true);
        const targetRole = createRole(ROLE_ID, "Student", 5, false, () => targetRoleEditable);
        providerTargetRole = targetRole;
        const managedRole = createRole(MANAGED_ROLE_ID, "Integration", 4, true, false);
        const highRole = createRole(HIGH_ROLE_ID, "Owner helper", 12, false, true);
        const timeoutRole = createRole(TIMEOUT_ROLE_ID, "Slow role", 3, false, true);
        const roles = new Collection<string, never>([
          [GUILD_ID, everyoneRole as never],
          [MEMBER_BASE_ROLE_ID, memberBaseRole as never],
          [BOT_ROLE_ID, botRole as never],
          [ROLE_ID, targetRole as never],
          [MANAGED_ROLE_ID, managedRole as never],
          [HIGH_ROLE_ID, highRole as never],
          [TIMEOUT_ROLE_ID, timeoutRole as never],
        ]);
        const targetRoleCache = new Collection<string, never>([
          [GUILD_ID, everyoneRole as never],
          [MEMBER_BASE_ROLE_ID, memberBaseRole as never],
        ]);
        const agentRoleCache = new Collection<string, never>([
          [GUILD_ID, everyoneRole as never],
          [BOT_ROLE_ID, botRole as never],
        ]);
        const targetHighest = {
          get position(): number {
            return targetHighestPosition;
          },
        };
        const agentHighest = {
          position: 10,
          comparePositionTo(other: unknown): number {
            const position = Reflect.get(other as object, "position");
            return 10 - (typeof position === "number" ? position : 0);
          },
        };
        const target: Record<string, unknown> = {
          id: USER_ID,
          guild,
          user: {
            id: USER_ID,
            username: "student",
            displayName: "Student",
            avatar: null,
            bot: false,
          },
          displayName: "Student",
          nickname: null,
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        };
        Object.assign(target, {
          roles: {
            cache: targetRoleCache,
            highest: targetHighest,
            add: async (roleId: string, reason: string) => {
              records.adds.push(Object.freeze({ roleId, reason }));
              const role = roles.get(roleId);
              if (role === undefined) throw providerNotFound();
              targetRoleCache.set(roleId, role);
              notifyAddStarted?.();
              if (holdNextAdd) {
                holdNextAdd = false;
                await new Promise<void>((resolve) => {
                  resolveHeldAdd = resolve;
                });
              }
              return target;
            },
            remove: async (roleId: string, reason: string) => {
              records.removes.push(Object.freeze({ roleId, reason }));
              targetRoleCache.delete(roleId);
              return target;
            },
          },
        });
        const agent = {
          id: BOT_ID,
          guild,
          user: { id: BOT_ID, bot: true },
          roles: { cache: agentRoleCache, highest: agentHighest },
          permissions: {
            has: (permission: bigint) =>
              permission !== PermissionFlagsBits.ManageRoles || canManageRoles,
          },
        };
        const members = new Map<string, unknown>([
          [USER_ID, target],
          [BOT_ID, agent],
        ]);
        const channelPermissions = new Set<bigint>([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ]);
        const channel = {
          id: CHANNEL_ID,
          guild,
          guildId: GUILD_ID,
          name: "welcome",
          type: ChannelType.GuildText,
          parentId: null,
          isTextBased: () => true,
          isVoiceBased: () => false,
          permissionsFor: () => ({ has: (permission: bigint) => channelPermissions.has(permission) }),
        };
        Object.assign(guild, {
          id: GUILD_ID,
          ownerId: OWNER_ID,
          roles: {
            cache: roles,
            fetch: async () => {
              records.roleFetches += 1;
              return roles;
            },
          },
          members: {
            cache: new Collection([...members.entries()] as never),
            fetch: async (input: Readonly<{ user: string }>) => {
              records.memberFetches += 1;
              const member = members.get(input.user);
              if (member === undefined) throw providerNotFound();
              return member;
            },
          },
          channels: {
            cache: new Collection([[CHANNEL_ID, channel as never]]),
            fetch: async (id: string) => {
              records.channelFetches += 1;
              return id === CHANNEL_ID ? channel : null;
            },
          },
        });
        this.guilds.cache.set(GUILD_ID, guild as never);
        this.__testReady = true;
        this.emit(Events.ClientReady, this as never);
        return TOKEN;
      },
    });
    Object.defineProperty(Client.prototype, "destroy", {
      ...destroyDescriptor,
      async value(this: MutableTestClient): Promise<void> {
        this.__testReady = false;
      },
    });

    const runtime = createNodeDiscordRuntime({
      botToken: TOKEN,
      gateway: {
        intents: ["Guilds", "GuildMembers"],
        acknowledgedPrivilegedIntents: ["GuildMembers"],
        queryTimeoutMs: 200,
        memberRoleOperationLedgerCapacity: 2,
        memberRoleOperationLedgerTtlMs: 60_000,
      },
    });

    try {
      await runtime.gateway.start();
      assert.ok(providerClient);
      assert.equal(runtime.guildResources, runtime.gateway);

      const member = await runtime.guildResources.readGuildMember({
        guildId: GUILD_ID,
        userId: USER_ID,
      });
      assert.deepEqual(member?.roleIds, [MEMBER_BASE_ROLE_ID, GUILD_ID]);
      assert.ok(Object.isFrozen(member));
      assert.ok(Object.isFrozen(member?.roleIds));
      assert.equal(
        await runtime.guildResources.readGuildMember({ guildId: GUILD_ID, userId: MISSING_ID }),
        null,
      );

      const role = await runtime.guildResources.readGuildRole({
        guildId: GUILD_ID,
        roleId: ROLE_ID,
      });
      assert.equal(role?.name, "Student");
      assert.equal(role?.editable, true);
      assert.ok(Object.isFrozen(role));
      assert.equal(
        await runtime.guildResources.readGuildRole({ guildId: GUILD_ID, roleId: MISSING_ID }),
        null,
      );

      const channel = await runtime.guildResources.readGuildChannel({
        guildId: GUILD_ID,
        channelId: CHANNEL_ID,
      });
      assert.deepEqual(channel, {
        guildId: GUILD_ID,
        id: CHANNEL_ID,
        name: "welcome",
        kind: "text",
        parentId: null,
        textBased: true,
        voiceBased: false,
        agentCanView: true,
        agentCanSendMessages: true,
        agentCanEmbedLinks: true,
        agentCanAttachFiles: true,
      });
      assert.ok(Object.isFrozen(channel));
      assert.equal(
        await runtime.guildResources.readGuildChannel({ guildId: GUILD_ID, channelId: MISSING_ID }),
        null,
      );
      assert.ok(records.roleFetches >= 6);
      assert.ok(records.memberFetches >= 6);
      assert.equal(records.channelFetches, 2);

      const addInput = {
        operationId: "member-role-add",
        guildId: GUILD_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
        auditReason: "approved onboarding assignment",
      } as const;
      const added = await runtime.guildResources.addRoleToMember(addInput);
      assert.deepEqual(added, {
        operationId: "member-role-add",
        status: "satisfied",
        action: "add",
        guildId: GUILD_ID,
        userId: USER_ID,
        roleId: ROLE_ID,
      });
      assert.ok(Object.isFrozen(added));
      assert.equal(records.adds.length, 1);
      assert.equal(await runtime.guildResources.addRoleToMember(addInput), added);
      assert.equal(records.adds.length, 1);
      await assert.rejects(
        runtime.guildResources.removeRoleFromMember({
          ...addInput,
          auditReason: "ambiguous replay",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );

      await runtime.guildResources.addRoleToMember({
        ...addInput,
        operationId: "member-role-noop",
      });
      assert.equal(records.adds.length, 1);
      await runtime.guildResources.removeRoleFromMember({
        ...addInput,
        operationId: "member-role-remove",
        auditReason: "approved onboarding removal",
      });
      assert.equal(records.removes.length, 1);
      await assert.rejects(
        runtime.guildResources.addRoleToMember({
          ...addInput,
          operationId: "member-role-remove",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );
      await runtime.guildResources.removeRoleFromMember({
        ...addInput,
        operationId: "member-role-add",
        auditReason: "reconcile after bounded-ledger eviction",
      });
      assert.equal(records.removes.length, 1);

      const activeGuild = providerGuild as Record<string, unknown> | null;
      const activeTargetRole = providerTargetRole as Record<string, unknown> | null;
      if (activeGuild === null || activeTargetRole === null) {
        throw new Error("provider guild fixture was not initialized");
      }
      const writesBeforeGuards = records.adds.length;
      canManageRoles = false;
      await assert.rejects(
        runtime.guildResources.addRoleToMember({ ...addInput, operationId: "guard-permission" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      canManageRoles = true;
      await assert.rejects(
        runtime.guildResources.addRoleToMember({
          ...addInput,
          operationId: "guard-agent",
          userId: BOT_ID,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      await assert.rejects(
        runtime.guildResources.addRoleToMember({
          ...addInput,
          operationId: "guard-everyone",
          roleId: GUILD_ID,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      await assert.rejects(
        runtime.guildResources.addRoleToMember({
          ...addInput,
          operationId: "guard-managed",
          roleId: MANAGED_ROLE_ID,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      await assert.rejects(
        runtime.guildResources.addRoleToMember({
          ...addInput,
          operationId: "guard-role-hierarchy",
          roleId: HIGH_ROLE_ID,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      targetHighestPosition = 10;
      await assert.rejects(
        runtime.guildResources.addRoleToMember({ ...addInput, operationId: "guard-member-hierarchy" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      targetHighestPosition = 1;
      activeGuild["ownerId"] = USER_ID;
      await assert.rejects(
        runtime.guildResources.addRoleToMember({ ...addInput, operationId: "guard-owner" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      activeGuild["ownerId"] = OWNER_ID;
      targetRoleEditable = false;
      await assert.rejects(
        runtime.guildResources.addRoleToMember({ ...addInput, operationId: "guard-editable" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.providerStatus === 403,
      );
      targetRoleEditable = true;
      activeTargetRole["guild"] = { id: MISSING_ID };
      await assert.rejects(
        runtime.guildResources.addRoleToMember({ ...addInput, operationId: "guard-guild-match" }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_RESPONSE_INVALID",
      );
      activeTargetRole["guild"] = activeGuild;
      assert.equal(records.adds.length, writesBeforeGuards);

      const aborted = new AbortController();
      aborted.abort();
      await assert.rejects(
        runtime.guildResources.readGuildRole({
          guildId: GUILD_ID,
          roleId: ROLE_ID,
          signal: aborted.signal,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_CANCELLED",
      );
      await assert.rejects(
        runtime.guildResources.readGuildRole({
          guildId: GUILD_ID,
          roleId: ROLE_ID,
          deadlineEpochMs: Date.now() - 1,
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_TIMEOUT",
      );

      holdNextAdd = true;
      const started = addStarted();
      const slowInput = {
        operationId: "member-role-timeout",
        guildId: GUILD_ID,
        userId: USER_ID,
        roleId: TIMEOUT_ROLE_ID,
        auditReason: "slow provider reconciliation",
        deadlineEpochMs: Date.now() + 25,
      } as const;
      const slow = runtime.guildResources.addRoleToMember(slowInput);
      await started;
      await assert.rejects(
        slow,
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_OUTCOME_UNKNOWN",
      );
      const releaseHeldAdd = resolveHeldAdd as (() => void) | null;
      if (releaseHeldAdd === null) throw new Error("member-role mutation was not dispatched");
      releaseHeldAdd();
      await nextTurn();
      const reconciled = await runtime.guildResources.addRoleToMember({
        ...slowInput,
        deadlineEpochMs: Date.now() + 200,
      });
      assert.equal(reconciled.status, "satisfied");
      assert.equal(records.adds.filter((entry) => entry.roleId === TIMEOUT_ROLE_ID).length, 1);
    } finally {
      await runtime.gateway.stop();
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
    }
  });
});
