import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const temporary = mkdtempSync(path.join(tmpdir(), "discord-bot-core-smoke-"));

try {
  const packed = JSON.parse(
    execFileSync(
      "npm",
      ["pack", "--json", "--pack-destination", temporary],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    ),
  );
  const metadata = Array.isArray(packed)
    ? packed[0]
    : packed !== null && typeof packed === "object"
      ? Object.values(packed)[0]
      : undefined;
  const filename = metadata?.filename;
  if (typeof filename !== "string") throw new Error("npm pack did not return a tarball.");
  const tarball = path.join(temporary, filename);
  const consumer = path.join(temporary, "consumer");
  execFileSync("mkdir", [consumer]);
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "discord-core-smoke-consumer", private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    { cwd: consumer, stdio: "inherit" },
  );
  writeFileSync(
    path.join(consumer, "smoke.mjs"),
    `
      import {
        EmbedPlanBuilder,
        createSafeDiscordMessage,
        discordButton,
        discordMessageActionRow,
      } from "@anto-project/discord-bot-core";
      import {
        NodeDiscordRestAdapter,
        createNodeDiscordProviderExtension,
        createNodeDiscordRuntime,
      } from "@anto-project/discord-bot-core/node";
      const embed = EmbedPlanBuilder.info({ locale: "en" }).description("ok").build();
      const row = discordMessageActionRow([
        discordButton({ style: "primary", label: "OK", customId: "smoke:ok" }),
      ]);
      const payload = createSafeDiscordMessage(
        { deliveryId: "smoke/delivery", embeds: [embed], components: [row] },
        "123456789012345678",
      );
      if (payload.embeds?.[0]?.description !== "ok") throw new Error("root export failed");
      if (payload.components?.[0]?.components.length !== 1) {
        throw new Error("component payload export failed");
      }
      const rest = new NodeDiscordRestAdapter({ botToken: "smoke-token-value-with-enough-length" });
      if (JSON.stringify(rest).includes("smoke-token")) throw new Error("token leaked");
      const runtime = createNodeDiscordRuntime({
        botToken: "runtime-smoke-token-value-with-enough-length",
        gateway: { intents: ["Guilds"] },
      });
      if (
        runtime.inspection !== runtime.gateway ||
        runtime.guilds !== runtime.gateway ||
        runtime.profiles !== runtime.gateway ||
        runtime.presence !== runtime.gateway
      ) {
        throw new Error("runtime service composition failed");
      }
      const extension = createNodeDiscordProviderExtension({
        key: "smoke.extension",
        bindProviderClient() {},
        async releaseProviderClient() {},
      });
      if (JSON.stringify(extension) !== "{}") throw new Error("extension bridge is not opaque");
      await runtime.gateway.stop();
    `,
  );
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: consumer, stdio: "inherit" });

  const installedManifest = JSON.parse(
    readFileSync(
      path.join(consumer, "node_modules", "@anto-project", "discord-bot-core", "package.json"),
      "utf8",
    ),
  );
  if (installedManifest.dependencies?.["discord.js"] !== "14.27.0") {
    throw new Error("The provider SDK is not owned by the core package.");
  }

  const rawConsumer = path.join(temporary, "raw-consumer");
  const rawSource = path.join(rawConsumer, "vendor", "discord-bot-core");
  mkdirSync(path.join(rawSource, "vendor", "dynamic-embed-engine"), { recursive: true });
  for (const entry of ["package.json", "README.md", "dist"]) {
    cpSync(path.resolve(entry), path.join(rawSource, entry), { recursive: true });
  }
  for (const entry of ["package.json", "README.md", "dist"]) {
    cpSync(
      path.resolve("vendor", "dynamic-embed-engine", entry),
      path.join(rawSource, "vendor", "dynamic-embed-engine", entry),
      { recursive: true },
    );
  }
  writeFileSync(
    path.join(rawConsumer, "package.json"),
    JSON.stringify({
      name: "discord-core-raw-consumer",
      private: true,
      type: "module",
      workspaces: ["vendor/discord-bot-core"],
      dependencies: { "@anto-project/discord-bot-core": "workspace:*" },
    }),
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: rawConsumer, stdio: "inherit" },
  );
  writeFileSync(
    path.join(rawConsumer, "smoke.mjs"),
    `
      import { escapeDiscordMarkdownLiteral } from "@anto-project/discord-bot-core";
      import { NodeDiscordRestAdapter } from "@anto-project/discord-bot-core/node";
      if (escapeDiscordMarkdownLiteral("@everyone") !== "@\\u200beveryone") {
        throw new Error("raw file dependency export failed");
      }
      const rest = new NodeDiscordRestAdapter({
        botToken: "raw-smoke-token-value-with-enough-length",
      });
      if (JSON.stringify(rest).includes("raw-smoke-token")) {
        throw new Error("raw token leaked");
      }
    `,
  );
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: rawConsumer, stdio: "inherit" });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
