export type DiscordPresenceActivityType =
  | "playing"
  | "listening"
  | "watching"
  | "streaming"
  | "competing";

export type DiscordPresenceStatus = "online" | "idle" | "dnd" | "invisible";

export type DiscordPresencePlan = Readonly<{
  text: string;
  activityType: DiscordPresenceActivityType;
  status: DiscordPresenceStatus;
  signal?: AbortSignal;
}>;

export interface DiscordPresencePort {
  apply(plan: DiscordPresencePlan): Promise<void>;
  clear(signal?: AbortSignal): Promise<void>;
}
