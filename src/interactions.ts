import type { EmbedPlan } from "../vendor/dynamic-embed-engine/dist/index.js";

import type { DiscordMessageActionRow, DiscordModalPlan } from "./components.js";

export type DiscordResponseVisibility = "public" | "ephemeral";

export type DiscordInteractionMessagePlan = Readonly<{
  readonly content?: string;
  readonly embeds?: readonly EmbedPlan[];
  readonly components?: readonly DiscordMessageActionRow[];
  readonly visibility?: DiscordResponseVisibility;
}>;

export type DiscordEditableInteractionMessagePlan = Omit<
  DiscordInteractionMessagePlan,
  "visibility"
>;

export interface DiscordInteractionResponder {
  readonly replied: boolean;
  readonly deferred: boolean;
  reply(plan: DiscordInteractionMessagePlan): Promise<void>;
  deferReply(visibility?: DiscordResponseVisibility): Promise<void>;
  editReply(plan: DiscordEditableInteractionMessagePlan): Promise<void>;
  followUp(plan: DiscordInteractionMessagePlan): Promise<void>;
  deferUpdate(): Promise<void>;
  update(plan: DiscordEditableInteractionMessagePlan): Promise<void>;
  showModal(modal: DiscordModalPlan): Promise<void>;
}

export type DiscordInteractionUser = Readonly<{
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}>;

export type DiscordInteractionGuild = Readonly<{
  id: string;
  name: string;
  iconUrl: string | null;
}>;

export type DiscordInteractionBot = Readonly<{
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}>;

export interface DiscordCommandOptionsPort {
  getBoolean(name: string, required?: boolean): boolean | null;
  getUser(name: string, required?: boolean): DiscordInteractionUser | null;
  getSubcommand(required?: boolean): string | null;
  getString(name: string, required?: boolean): string | null;
  getInteger(name: string, required?: boolean): number | null;
  getNumber(name: string, required?: boolean): number | null;
  getChannelId(name: string, required?: boolean): string | null;
  getRoleId(name: string, required?: boolean): string | null;
}

export type DiscordInteractionBase = Readonly<{
  id: string;
  locale: string;
  channelId: string | null;
  user: DiscordInteractionUser;
  guild: DiscordInteractionGuild | null;
  bot: DiscordInteractionBot;
  createdAt: string;
  responder: DiscordInteractionResponder;
}>;

export type DiscordChatInputInteraction = DiscordInteractionBase &
  Readonly<{
    kind: "chat_input";
    commandName: string;
    options: DiscordCommandOptionsPort;
  }>;

export type DiscordButtonInteraction = DiscordInteractionBase &
  Readonly<{
    kind: "button";
    customId: string;
  }>;

export type DiscordStringSelectInteraction = DiscordInteractionBase &
  Readonly<{
    kind: "string_select";
    customId: string;
    values: readonly string[];
  }>;

export type DiscordUserSelectInteraction = DiscordInteractionBase &
  Readonly<{
    kind: "user_select";
    customId: string;
    userIds: readonly string[];
  }>;

export interface DiscordModalFieldsPort {
  getText(customId: string): string;
}

export type DiscordModalSubmitInteraction = DiscordInteractionBase &
  Readonly<{
    kind: "modal_submit";
    customId: string;
    fields: DiscordModalFieldsPort;
  }>;

export type DiscordInteraction =
  | DiscordButtonInteraction
  | DiscordChatInputInteraction
  | DiscordModalSubmitInteraction
  | DiscordStringSelectInteraction
  | DiscordUserSelectInteraction;

export type DiscordInteractionListener = (
  interaction: DiscordInteraction,
) => void | Promise<void>;
