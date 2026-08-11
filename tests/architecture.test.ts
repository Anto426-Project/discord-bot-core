import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  NodeDiscordGatewayAdapter,
  NodeDiscordRestAdapter,
  createNodeDiscordRuntime,
} from "../src/discordjs.js";

const TEST_TOKEN = "provider-token-value-that-must-not-serialize";

const collect = async (directory: string, suffix: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
          ? collect(target, suffix)
          : entry.isFile() && entry.name.endsWith(suffix)
            ? [target]
            : [];
      }),
    )
  ).flat();
};

describe("discord bot core architecture", () => {
  it("keeps the provider SDK inside its single implementation adapter", async () => {
    const sourceFiles = await collect(path.resolve("src"), ".ts");
    for (const file of sourceFiles) {
      const source = await readFile(file, "utf8");
      if (path.basename(file) === "discordjs.ts") continue;
      assert.doesNotMatch(source, /["']discord\.js["']|["']@discordjs\//u, file);
    }

    const declarations = (
      await Promise.all((await collect(path.resolve("dist"), ".d.ts")).map((file) => readFile(file, "utf8")))
    ).join("\n");
    assert.doesNotMatch(declarations, /discord\.js|@discordjs\//iu);
    assert.doesNotMatch(declarations, /DiscordJs/u);
  });

  it("shares one provider-neutral action-row encoder across interactions and REST delivery", async () => {
    const payloadSource = await readFile(path.resolve("src/payload.ts"), "utf8");
    const adapterSource = await readFile(path.resolve("src/discordjs.ts"), "utf8");
    const declarations = await readFile(path.resolve("dist/payload.d.ts"), "utf8");

    assert.match(payloadSource, /export const encodeSafeDiscordActionRows/u);
    assert.match(adapterSource, /encodeSafeDiscordActionRows\(plan\.components\)/u);
    assert.doesNotMatch(adapterSource, /const encodeActionRows/u);
    assert.match(declarations, /interface DiscordMessagePlan/u);
    assert.match(declarations, /components\?: readonly DiscordMessageActionRow\[\]/u);
  });

  it("contains no product, service authority or ambient secret lookup", async () => {
    const source = (
      await Promise.all((await collect(path.resolve("src"), ".ts")).map((file) => readFile(file, "utf8")))
    ).join("\n");
    for (const forbidden of [
      /\bantobot\b/iu,
      /\bunibot\b/iu,
      /\buniversity[-_ ]?platform\b/iu,
      /\baccess[-_ ]?broker\b/iu,
      /\bcoredb\b/iu,
      /process\.env/u,
      /from\s+["']node:(?:fs|http|https|net)[^"']*["']/u,
    ]) {
      assert.doesNotMatch(source, forbidden);
    }
  });

  it("requires explicit privileged intent acknowledgement and hides credentials", () => {
    assert.throws(
      () =>
        new NodeDiscordGatewayAdapter({
          botToken: TEST_TOKEN,
          intents: ["Guilds", "MessageContent"],
        }),
      /privileged/iu,
    );
    const gateway = new NodeDiscordGatewayAdapter({
      botToken: TEST_TOKEN,
      intents: ["Guilds", "MessageContent"],
      acknowledgedPrivilegedIntents: ["MessageContent"],
    });
    assert.deepEqual(gateway.toJSON(), { component: "node-discord-gateway-adapter" });
    gateway.subscribeInteractions(async () => undefined);
    assert.throws(
      () => gateway.subscribeInteractions(async () => undefined),
      /one interaction router/iu,
    );

    const rest = new NodeDiscordRestAdapter({ botToken: TEST_TOKEN });
    assert.doesNotMatch(JSON.stringify(rest), /provider-token/u);
    assert.deepEqual(rest.toJSON(), { component: "node-discord-rest-adapter" });

    const runtime = createNodeDiscordRuntime({
      botToken: TEST_TOKEN,
      gateway: { intents: ["Guilds"] },
    });
    assert.equal(runtime.commands, runtime.messages);
    assert.equal(runtime.extensions, runtime.gateway);
    assert.doesNotMatch(JSON.stringify(runtime), /provider-token/u);
  });
});
