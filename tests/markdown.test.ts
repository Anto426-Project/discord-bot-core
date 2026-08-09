import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escapeDiscordMarkdownLiteral } from "../src/index.js";

describe("Discord Markdown literal projection", () => {
  it("escapes provider formatting and mention syntax", () => {
    assert.equal(
      escapeDiscordMarkdownLiteral("**hello** @everyone <@123456789012345678>"),
      "\\*\\*hello\\*\\* @\u200beveryone \\<@\u200b123456789012345678\\>",
    );
  });

  it("rejects unbounded or unsafe control input", () => {
    assert.throws(() => escapeDiscordMarkdownLiteral("x".repeat(16_385)), /safely/iu);
    assert.throws(() => escapeDiscordMarkdownLiteral("unsafe\u0000text"), /safely/iu);
  });
});
