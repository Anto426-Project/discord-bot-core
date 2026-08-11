import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  ChannelType,
  Client,
  Collection,
  Events,
  REST,
} from "discord.js";

import { DiscordCoreError } from "../src/errors.js";
import {
  NodeDiscordRestAdapter,
  createNodeDiscordRuntime,
} from "../src/discordjs.js";
import type { DiscordGatewayEvent } from "../src/gateway-events.js";

const TOKEN = "operational-provider-token-with-enough-length";
const BOT_ID = "12345678901234567";
const APP_ID = "22345678901234567";
const GUILD_ID = "32345678901234567";
const ACTOR_ID = "42345678901234567";
const TARGET_ID = "52345678901234567";
const TEXT_ID = "62345678901234567";
const VOICE_ID = "72345678901234567";
const CATEGORY_ID = "82345678901234567";
const CREATED_VOICE_ID = "92345678901234567";
const MESSAGE_ID = "13345678901234567";
const RULE_ID = "23345678901234567";
const ROLE_ID = "33345678901234567";

type MutableTestClient = Client & { __testReady?: boolean };

const nextTurn = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const providerNotFound = (): Error & { status: number; code: number } =>
  Object.assign(new Error("provider secret must not escape"), {
    status: 404,
    code: 10_007,
  });

describe("provider-neutral Discord operational ports", () => {
  it("normalizes events and applies only technical provider effects", async () => {
    const loginDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "login");
    const destroyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "destroy");
    const readyDescriptor = Object.getOwnPropertyDescriptor(Client.prototype, "isReady");
    const restGetDescriptor = Object.getOwnPropertyDescriptor(REST.prototype, "get");
    assert.ok(loginDescriptor);
    assert.ok(destroyDescriptor);
    assert.ok(readyDescriptor);
    assert.ok(restGetDescriptor);

    let providerClient: MutableTestClient | null = null;
    let providerGuild: Record<string, unknown> | null = null;
    let providerActor: Record<string, unknown> | null = null;
    let holdNextVoiceEdit = false;
    let failNextVoiceEdit = false;
    let resolveHeldVoiceEdit: (() => void) | null = null;
    let commandRestCoordinator: REST | null = null;
    const records = {
      kicked: [] as string[],
      banned: [] as unknown[],
      unbanned: [] as unknown[],
      timedOut: [] as unknown[],
      deletedMessages: [] as string[],
      createdChannels: [] as unknown[],
      movedChannels: [] as unknown[],
      editedChannels: [] as unknown[],
      deletedChannels: [] as string[],
      editedOverwrites: [] as unknown[],
      deletedOverwrites: [] as string[],
      createdRules: [] as unknown[],
      updatedRules: [] as unknown[],
      deletedRules: [] as string[],
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
        const permissions = { has: () => true };
        const everyoneRole = {
          id: GUILD_ID,
          guild,
          name: "@everyone",
          color: 0,
          position: 0,
          managed: false,
          editable: false,
          permissions,
        };
        const operatorRole = {
          id: ROLE_ID,
          guild,
          name: "Operators",
          color: 0x12_34_56,
          position: 3,
          managed: false,
          editable: true,
          permissions,
        };
        const roles = new Collection<string, never>([
          [GUILD_ID, everyoneRole as never],
          [ROLE_ID, operatorRole as never],
        ]);
        const createMember = (id: string, displayName: string) => ({
          id,
          guild,
          user: {
            id,
            username: displayName.toLowerCase(),
            displayName,
            avatar: null,
            bot: id === BOT_ID,
            createdAt: new Date("2020-01-01T00:00:00.000Z"),
          },
          displayName,
          nickname: null,
          joinedAt: new Date("2025-01-01T00:00:00.000Z"),
          roles: {
            cache: roles,
            highest: { comparePositionTo: () => 1 },
          },
          permissions,
          voice: {
            setChannel: async (channel: unknown, reason: string) => {
              records.movedChannels.push({ id, channel, reason });
            },
          },
          kick: async (reason: string) => {
            records.kicked.push(reason);
          },
          timeout: async (milliseconds: number, reason: string) => {
            records.timedOut.push({ id, milliseconds, reason });
          },
        });
        const actor = createMember(ACTOR_ID, "Actor");
        providerActor = actor;
        const target = createMember(TARGET_ID, "Target");
        const agent = createMember(BOT_ID, "Core Bot");
        const members = new Map([
          [ACTOR_ID, actor],
          [TARGET_ID, target],
          [BOT_ID, agent],
        ]);

        const textChannel = {
          id: TEXT_ID,
          guildId: GUILD_ID,
          type: ChannelType.GuildText,
          isTextBased: () => true,
          permissionsFor: () => permissions,
          bulkDelete: async () =>
            new Collection<string, never>([
              [MESSAGE_ID, {} as never],
              ["14345678901234567", {} as never],
            ]),
          messages: {
            fetch: async (id: string) => ({
              id,
              delete: async () => {
                records.deletedMessages.push(id);
              },
            }),
          },
        };
        const voiceChannel = {
          id: VOICE_ID,
          guildId: GUILD_ID,
          type: ChannelType.GuildVoice,
          permissionOverwrites: {
            cache: new Collection<string, never>(),
            edit: async (id: string, permissionPlan: unknown, options: unknown) => {
              records.editedOverwrites.push({ id, permissionPlan, options });
              return voiceChannel;
            },
            delete: async (id: string) => {
              records.deletedOverwrites.push(id);
              return voiceChannel;
            },
          },
          edit: async (options: unknown) => {
            records.editedChannels.push(options);
            if (failNextVoiceEdit) {
              failNextVoiceEdit = false;
              throw new Error("provider network secret");
            }
            if (holdNextVoiceEdit) {
              holdNextVoiceEdit = false;
              await new Promise<void>((resolve) => {
                resolveHeldVoiceEdit = resolve;
              });
            }
            return voiceChannel;
          },
          delete: async () => {
            records.deletedChannels.push(VOICE_ID);
          },
        };
        const category = {
          id: CATEGORY_ID,
          guildId: GUILD_ID,
          type: ChannelType.GuildCategory,
        };
        const channels = new Collection<string, never>([
          [TEXT_ID, textChannel as never],
          [VOICE_ID, voiceChannel as never],
          [CATEGORY_ID, category as never],
        ]);

        const providerRule = {
          id: RULE_ID,
          creatorId: BOT_ID,
          name: "Managed rule",
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType: AutoModerationRuleTriggerType.Spam,
          triggerMetadata: {
            keywordFilter: [],
            regexPatterns: [],
            presets: [],
            allowList: [],
            mentionTotalLimit: null,
            mentionRaidProtectionEnabled: false,
          },
          actions: [
            {
              type: AutoModerationActionType.BlockMessage,
              metadata: {
                channelId: null,
                durationSeconds: null,
                customMessage: null,
              },
            },
          ],
          enabled: true,
          exemptRoles: new Collection(),
          exemptChannels: new Collection(),
        };
        const rules = new Collection<string, never>([[RULE_ID, providerRule as never]]);

        Object.assign(guild, {
          id: GUILD_ID,
          name: "Operational Guild",
          preferredLocale: "en-US",
          shardId: 0,
          joinedAt: new Date("2024-01-01T00:00:00.000Z"),
          ownerId: "93345678901234567",
          memberCount: members.size,
          channels: {
            cache: channels,
            fetch: async (id: string) => channels.get(id) ?? null,
            create: async (options: unknown) => {
              records.createdChannels.push(options);
              return { id: CREATED_VOICE_ID };
            },
          },
          roles: { cache: roles },
          members: {
            cache: new Collection([...members.entries()] as never),
            fetch: async (input: string | Readonly<{ user: string }>) => {
              const id = typeof input === "string" ? input : input.user;
              const member = members.get(id);
              if (member === undefined) throw providerNotFound();
              return member;
            },
            ban: async (id: string, options: unknown) => {
              records.banned.push({ id, options });
            },
            unban: async (id: string, reason: string) => {
              records.unbanned.push({ id, reason });
            },
          },
          bans: { fetch: async () => ({ user: target.user }) },
          autoModerationRules: {
            fetch: async (id?: string) => {
              if (id === undefined) return rules;
              if (id !== RULE_ID) throw providerNotFound();
              return providerRule;
            },
            create: async (options: unknown) => {
              records.createdRules.push(options);
              return providerRule;
            },
            edit: async (id: string, options: unknown) => {
              records.updatedRules.push({ id, options });
              return providerRule;
            },
            delete: async (id: string) => {
              records.deletedRules.push(id);
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
    Object.defineProperty(REST.prototype, "get", {
      ...restGetDescriptor,
      async value(this: REST): Promise<unknown> {
        commandRestCoordinator = this;
        return [];
      },
    });

    const runtime = createNodeDiscordRuntime({
      botToken: TOKEN,
      gateway: {
        intents: [
          "Guilds",
          "GuildMembers",
          "GuildModeration",
          "GuildVoiceStates",
          "GuildMessages",
          "MessageContent",
          "AutoModerationConfiguration",
          "AutoModerationExecution",
        ],
        acknowledgedPrivilegedIntents: ["GuildMembers", "MessageContent"],
        listenerTimeoutMs: 100,
        queryTimeoutMs: 100,
        maximumGatewayEventBacklog: 2,
      },
    });

    try {
      await runtime.gateway.start();
      assert.ok(providerClient);
      assert.ok(providerGuild);
      assert.equal(runtime.events, runtime.gateway);
      assert.equal(runtime.moderation, runtime.gateway);
      assert.equal(runtime.botAutoMod, runtime.gateway);
      assert.equal(runtime.nativeAutoMod, runtime.gateway);
      assert.equal(runtime.voiceRooms, runtime.gateway);
      const activeProvider = providerClient as MutableTestClient | null;
      const activeGuild = providerGuild as Record<string, unknown> | null;
      const activeActor = providerActor as Record<string, unknown> | null;
      if (activeProvider === null || activeGuild === null || activeActor === null) {
        throw new Error("provider fixture was not initialized");
      }
      await runtime.commands.listApplicationCommands({
        kind: "global",
        ownership: "provider_command_id",
        ownerKey: "tests.operational",
        applicationId: APP_ID,
      });
      assert.equal(commandRestCoordinator, activeProvider.rest);
      const firstGatewayRestCoordinator = activeProvider.rest;

      const events: DiscordGatewayEvent[] = [];
      const unsubscribe = runtime.events.subscribe((event) => {
        events.push(event);
      });
      activeProvider.emit(Events.GuildCreate, activeGuild as never);
      await nextTurn();
      const guildEvent = events[0];
      if (guildEvent?.type !== "guild_created") {
        throw new Error("guild event was not normalized");
      }
      assert.deepEqual(guildEvent, {
        type: "guild_created",
        guildId: GUILD_ID,
        name: "Operational Guild",
        preferredLocale: "en-US",
        shardId: 0,
        joinedAt: "2024-01-01T00:00:00.000Z",
        observedAt: guildEvent.observedAt,
      });
      assert.match(guildEvent.observedAt, /^\d{4}-\d{2}-\d{2}T/u);
      assert.equal("content" in guildEvent, false);

      activeProvider.emit(Events.MessageCreate, {
        id: MESSAGE_ID,
        guildId: GUILD_ID,
        channelId: TEXT_ID,
        member: activeActor,
        author: activeActor["user"],
        createdAt: new Date("2026-08-11T10:00:00.000Z"),
        webhookId: null,
        content: "Sensitive message content",
        inGuild: () => true,
      } as never);
      await nextTurn();
      const messageEvent = events[1];
      if (messageEvent?.type !== "message_created") {
        throw new Error("message event was not normalized");
      }
      assert.equal("content" in messageEvent, false);
      assert.match(messageEvent.contentFingerprint ?? "", /^[a-f0-9]{64}$/u);
      assert.doesNotMatch(JSON.stringify(messageEvent), /Sensitive message content/u);

      activeProvider.emit(Events.GuildMemberRemove, {
        id: TARGET_ID,
        guild: activeGuild,
      } as never);
      await nextTurn();
      const removal = events[2];
      if (removal?.type !== "guild_member_removed") {
        throw new Error("partial member removal was not normalized");
      }
      assert.equal(removal.userId, TARGET_ID);
      assert.equal(removal.member, null);
      assert.deepEqual(removal.roles, []);
      unsubscribe();

      let slowListenerCalls = 0;
      let stallSlowListener = true;
      let releaseSlowListener!: () => void;
      const lifecycleErrors: string[] = [];
      const unsubscribeLifecycle = runtime.gateway.subscribeLifecycle((event) => {
        if (event.type === "runtime_degraded" || event.type === "runtime_recovered") {
          lifecycleErrors.push(`${event.type}:${event.code}`);
        }
      });
      runtime.events.subscribe(async () => {
        slowListenerCalls += 1;
        if (stallSlowListener) {
          await new Promise<void>((resolve) => {
            releaseSlowListener = resolve;
          });
        }
      });
      for (let index = 0; index < 4; index += 1) {
        activeProvider.emit(Events.GuildCreate, activeGuild as never);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(slowListenerCalls, 1);
      assert.deepEqual(lifecycleErrors, [
        "runtime_degraded:DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED",
        "runtime_degraded:DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED",
        "runtime_recovered:DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED",
      ]);
      stallSlowListener = false;
      releaseSlowListener();
      await nextTurn();
      assert.deepEqual(lifecycleErrors, [
        "runtime_degraded:DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED",
        "runtime_degraded:DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED",
        "runtime_recovered:DISCORD_GATEWAY_EVENT_BACKLOG_EXHAUSTED",
        "runtime_recovered:DISCORD_GATEWAY_EVENT_LISTENER_QUARANTINED",
      ]);
      activeProvider.emit(Events.GuildCreate, activeGuild as never);
      await nextTurn();
      assert.equal(slowListenerCalls, 2);
      unsubscribeLifecycle();

      assert.equal(
        (await runtime.moderation.readActorFacts({
          guildId: GUILD_ID,
          actorUserId: ACTOR_ID,
          requiredPermission: "kick_members",
        })).actorHasRequiredPermission,
        true,
      );
      assert.equal(
        (await runtime.moderation.readMemberFacts({
          guildId: GUILD_ID,
          actorUserId: ACTOR_ID,
          targetUserId: TARGET_ID,
          requiredPermission: "ban_members",
        })).targetDisplayName,
        "Target",
      );
      assert.equal(
        (await runtime.moderation.readChannelFacts({
          guildId: GUILD_ID,
          channelId: TEXT_ID,
          actorUserId: ACTOR_ID,
        })).requiredPermission,
        "manage_messages",
      );
      assert.deepEqual(
        await runtime.moderation.deleteRecentMessages({
          operationId: "cleanup-1",
          guildId: GUILD_ID,
          channelId: TEXT_ID,
          requestedCount: 5,
        }),
        {
          operationId: "cleanup-1",
          status: "applied",
          guildId: GUILD_ID,
          channelId: TEXT_ID,
          requestedCount: 5,
          deletedCount: 2,
          skippedCount: 3,
        },
      );
      await runtime.moderation.kickMember({
        operationId: "kick-1",
        guildId: GUILD_ID,
        targetUserId: TARGET_ID,
        auditReason: "operator-reviewed kick",
      });
      await runtime.moderation.banMember({
        operationId: "ban-1",
        guildId: GUILD_ID,
        targetUserId: TARGET_ID,
        deleteMessageSeconds: 60,
        auditReason: "operator-reviewed ban",
      });
      await runtime.moderation.unbanMember({
        operationId: "unban-1",
        guildId: GUILD_ID,
        targetUserId: TARGET_ID,
        auditReason: "operator-reviewed unban",
      });
      assert.equal(records.kicked.length, 1);
      assert.equal(records.banned.length, 1);
      assert.equal(records.unbanned.length, 1);

      await runtime.botAutoMod.deleteMessage({
        operationId: "delete-message-1",
        guildId: GUILD_ID,
        channelId: TEXT_ID,
        messageId: MESSAGE_ID,
      });
      await runtime.botAutoMod.timeoutMember({
        operationId: "timeout-1",
        guildId: GUILD_ID,
        userId: TARGET_ID,
        durationSeconds: 60,
        auditReason: "automod timeout",
      });
      assert.deepEqual(records.deletedMessages, [MESSAGE_ID]);
      assert.deepEqual(records.timedOut, [
        { id: TARGET_ID, milliseconds: 60_000, reason: "automod timeout" },
      ]);

      const rules = await runtime.nativeAutoMod.listRules({ guildId: GUILD_ID });
      assert.equal(rules[0]?.providerRuleId, RULE_ID);
      assert.equal(rules[0]?.managedByCurrentApplication, true);
      const plan = {
        name: "Managed rule",
        eventType: "message_send" as const,
        trigger: { type: "spam" as const },
        actions: [{ type: "block_message" as const }],
        enabled: true,
        exemptRoleIds: [],
        exemptChannelIds: [],
      };
      await runtime.nativeAutoMod.createRule({
        operationId: "rule-create-1",
        guildId: GUILD_ID,
        rule: plan,
        auditReason: "create managed rule",
      });
      await runtime.nativeAutoMod.updateRule({
        operationId: "rule-update-1",
        guildId: GUILD_ID,
        providerRuleId: RULE_ID,
        rule: plan,
        auditReason: "update managed rule",
      });
      await assert.rejects(
        runtime.nativeAutoMod.updateRule({
          operationId: "rule-update-invalid-trigger",
          guildId: GUILD_ID,
          providerRuleId: RULE_ID,
          rule: {
            ...plan,
            trigger: {
              type: "keyword",
              keywordFilter: ["blocked"],
              regexPatterns: [],
              allowList: [],
            },
          },
          auditReason: "must replace instead",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );
      await runtime.nativeAutoMod.deleteRule({
        operationId: "rule-delete-1",
        guildId: GUILD_ID,
        providerRuleId: RULE_ID,
        auditReason: "delete managed rule",
      });
      assert.equal(records.createdRules.length, 1);
      assert.equal(records.updatedRules.length, 1);
      assert.deepEqual(records.deletedRules, [RULE_ID]);

      const overwrite = {
        target: { type: "member" as const, id: TARGET_ID },
        allow: ["view_channel" as const, "connect" as const],
        deny: [] as const,
      };
      assert.equal(
        (await runtime.voiceRooms.createRoom({
          operationId: "room-create-1",
          guildId: GUILD_ID,
          parentCategoryId: CATEGORY_ID,
          name: "Study Room",
          userLimit: 10,
          permissionOverwrites: [overwrite],
          auditReason: "create managed room",
        })).channelId,
        CREATED_VOICE_ID,
      );
      await runtime.voiceRooms.moveMember({
        operationId: "room-move-1",
        guildId: GUILD_ID,
        userId: TARGET_ID,
        channelId: VOICE_ID,
        auditReason: "move member",
      });
      await runtime.voiceRooms.updateRoom({
        operationId: "room-update-1",
        guildId: GUILD_ID,
        channelId: VOICE_ID,
        name: "Renamed Room",
        userLimit: 8,
        auditReason: "update managed room",
      });
      holdNextVoiceEdit = true;
      await assert.rejects(
        runtime.voiceRooms.updateRoom({
          operationId: "room-update-unknown-outcome",
          guildId: GUILD_ID,
          channelId: VOICE_ID,
          name: "Slow Room",
          auditReason: "test unknown outcome",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError &&
          error.code === "DISCORD_OUTCOME_UNKNOWN" &&
          error.retryable === false,
      );
      const releaseHeldEdit = resolveHeldVoiceEdit as (() => void) | null;
      if (releaseHeldEdit === null) throw new Error("voice mutation was not dispatched");
      releaseHeldEdit();
      await nextTurn();
      failNextVoiceEdit = true;
      await assert.rejects(
        runtime.voiceRooms.updateRoom({
          operationId: "room-update-network-unknown",
          guildId: GUILD_ID,
          channelId: VOICE_ID,
          name: "Network Room",
          auditReason: "test network ambiguity",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError &&
          error.code === "DISCORD_OUTCOME_UNKNOWN" &&
          error.retryable === false &&
          !JSON.stringify(error).includes("provider network secret"),
      );
      await runtime.voiceRooms.upsertPermissionOverwrite({
        operationId: "room-overwrite-1",
        guildId: GUILD_ID,
        channelId: VOICE_ID,
        overwrite,
        auditReason: "update member access",
      });
      await runtime.voiceRooms.deletePermissionOverwrite({
        operationId: "room-overwrite-delete-1",
        guildId: GUILD_ID,
        channelId: VOICE_ID,
        target: overwrite.target,
        auditReason: "remove member access",
      });
      await runtime.voiceRooms.deleteRoom({
        operationId: "room-delete-1",
        guildId: GUILD_ID,
        channelId: VOICE_ID,
        auditReason: "delete managed room",
      });
      assert.equal(records.createdChannels.length, 1);
      assert.equal(records.movedChannels.length, 1);
      assert.equal(records.editedChannels.length, 3);
      assert.equal(records.editedOverwrites.length, 1);
      assert.deepEqual(records.deletedChannels, [VOICE_ID]);

      await assert.rejects(
        runtime.voiceRooms.updateRoom({
          operationId: "empty-update",
          guildId: GUILD_ID,
          channelId: VOICE_ID,
          auditReason: "must fail closed",
        }),
        (error: unknown) =>
          error instanceof DiscordCoreError && error.code === "DISCORD_INVALID_INPUT",
      );

      await runtime.gateway.stop();
      await runtime.gateway.start();
      const restartedProvider = providerClient as MutableTestClient | null;
      if (restartedProvider === null) throw new Error("restarted provider client was not captured");
      await runtime.commands.listApplicationCommands({
        kind: "global",
        ownership: "provider_command_id",
        ownerKey: "tests.operational",
        applicationId: APP_ID,
      });
      assert.equal(commandRestCoordinator, restartedProvider.rest);
      assert.notEqual(restartedProvider.rest, firstGatewayRestCoordinator);

      const standalone = new NodeDiscordRestAdapter({ botToken: TOKEN });
      await standalone.listApplicationCommands({
        kind: "global",
        ownership: "provider_command_id",
        ownerKey: "tests.standalone",
        applicationId: APP_ID,
      });
      const standaloneCoordinator = commandRestCoordinator;
      assert.notEqual(standaloneCoordinator, restartedProvider.rest);
      await standalone.listApplicationCommands({
        kind: "global",
        ownership: "provider_command_id",
        ownerKey: "tests.standalone",
        applicationId: APP_ID,
      });
      assert.equal(commandRestCoordinator, standaloneCoordinator);
    } finally {
      await runtime.gateway.stop().catch(() => undefined);
      Object.defineProperty(Client.prototype, "login", loginDescriptor);
      Object.defineProperty(Client.prototype, "destroy", destroyDescriptor);
      Object.defineProperty(Client.prototype, "isReady", readyDescriptor);
      Object.defineProperty(REST.prototype, "get", restGetDescriptor);
    }
  });
});
