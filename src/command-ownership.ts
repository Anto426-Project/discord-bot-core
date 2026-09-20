import { fingerprintDiscordCommand, type DiscordApplicationCommandsRestPort, type DiscordCommandPublicationScope, type DiscordCommandPublicationSnapshotPort } from "./command-publisher.js";
import { DiscordCoreError } from "./errors.js";
import { parseStableBotKey } from "./identifiers.js";

export interface DiscordKnownCommandOwnership {
  readonly key: string;
  readonly commandName: string;
  /** Explicit fingerprints of catalog versions previously managed by this consumer. */
  readonly fingerprints: readonly string[];
}
/** One-time import of verified legacy ownership. A name match alone never grants ownership. */
export const bootstrapDiscordCommandOwnership = async (
  scope: DiscordCommandPublicationScope,
  known: readonly DiscordKnownCommandOwnership[],
  rest: DiscordApplicationCommandsRestPort,
  store: DiscordCommandPublicationSnapshotPort,
  signal: AbortSignal = AbortSignal.timeout(30_000)
): Promise<void> => {
  const keys = new Set<string>(), names = new Set<string>();
  for (const entry of known) {
    parseStableBotKey(entry.key);
    if (keys.has(entry.key) || names.has(entry.commandName) || entry.fingerprints.length === 0 || entry.fingerprints.some(value => !/^[a-f0-9]{64}$/u.test(value))) {
      throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Command ownership migration manifest is invalid.", false);
    }
    keys.add(entry.key); names.add(entry.commandName);
  }
  const lease = await store.claimScope(scope, 35_000, signal);
  if (lease === null) throw new DiscordCoreError("DISCORD_INVALID_INPUT", "Command publication scope is already leased.", true);
  try {
    if (await store.loadSnapshot(scope, lease, signal) !== null) return;
    const remote = await rest.listApplicationCommands(scope, signal);
    const commands = [];
    for (const entry of known) {
      const matches = remote.filter(command => command.kind === "chat_input" && command.name === entry.commandName);
      if (matches.length === 0) continue;
      const command = matches[0];
      if (matches.length !== 1 || command?.fingerprint == null || !entry.fingerprints.includes(command.fingerprint)) {
        throw new DiscordCoreError("DISCORD_INVALID_INPUT", `Existing command '${entry.commandName}' does not match the explicit ownership migration manifest.`, false);
      }
      commands.push({ key: entry.key, commandName: entry.commandName, providerCommandId: command.id, fingerprint: command.fingerprint });
    }
    await store.saveSnapshot(scope, lease, {
      schemaVersion: 5, revision: 0, ownerKey: scope.ownerKey, scopeKind: scope.kind,
      applicationId: scope.applicationId, guildId: scope.kind === "guild" ? scope.guildId : null,
      catalogFingerprint: fingerprintDiscordCommand(commands), commands, pending: null
    }, signal);
  } finally { await store.releaseScope(scope, lease); }
};
