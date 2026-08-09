import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDiscordApplicationCommandName,
  toDiscordApplicationCommand,
  type ChatInputCommandPlan,
} from "../src/index.js";

const baseCommand = (options: ChatInputCommandPlan["options"] = []): ChatInputCommandPlan =>
  Object.freeze({
    key: "help.command",
    name: { it: "aiuto", en: "help" },
    description: { it: "Mostra aiuto", en: "Show help" },
    options,
    allowInDirectMessages: true,
    defaultMemberPermissions: null,
  });

describe("Discord application command model", () => {
  it("maps stable plans without importing provider enums", () => {
    const mapped = toDiscordApplicationCommand(
      baseCommand([
        {
          kind: "string",
          name: { it: "categoria", en: "category" },
          description: { it: "Categoria", en: "Category" },
          required: true,
          completion: {
            kind: "choices",
            values: [{ name: { it: "tutto", en: "all" }, value: "all" }],
          },
        },
      ]),
      "global",
    );
    assert.equal(mapped.type, 1);
    assert.equal(mapped.options[0]?.["type"], 3);
    assert.deepEqual(mapped.contexts, [0, 1]);
  });

  it("uses the provider naming rule consistently", () => {
    assert.equal(assertDiscordApplicationCommandName("l'help"), "l'help");
    assert.equal(assertDiscordApplicationCommandName("คำสั่ง"), "คำสั่ง");
    assert.throws(() => assertDiscordApplicationCommandName("Upper"), /invalid/iu);
  });

  it("rejects required ordering and cross-localization sibling collisions", () => {
    const optional = {
      kind: "boolean" as const,
      name: { it: "opzionale", en: "optional" },
      description: { it: "Opzionale", en: "Optional" },
      required: false,
    };
    const required = {
      kind: "boolean" as const,
      name: { it: "richiesto", en: "required" },
      description: { it: "Richiesto", en: "Required" },
      required: true,
    };
    assert.throws(() => toDiscordApplicationCommand(baseCommand([optional, required]), "guild"), /required/iu);

    assert.throws(
      () =>
        toDiscordApplicationCommand(
          baseCommand([
            required,
            {
              ...optional,
              name: { it: "required", en: "second" },
            },
          ]),
          "guild",
        ),
      /localization/iu,
    );
  });
});
