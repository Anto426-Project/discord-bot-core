import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  discordButton,
  discordMessageActionRow,
  discordModal,
  discordSelectOption,
  discordStringSelect,
  discordTextInput,
  discordUserSelect,
} from "../src/index.js";

describe("stable Discord component plans", () => {
  it("builds provider-independent message and modal components", () => {
    const button = discordButton({ style: "primary", label: "Open", customId: "help:open" });
    const select = discordStringSelect({
      customId: "help:category",
      options: [discordSelectOption({ label: "All", value: "all" })],
    });
    const users = discordUserSelect({ customId: "voice:invite", maximumValues: 5 });
    assert.deepEqual(discordMessageActionRow([button]).components, [button]);
    assert.equal(discordMessageActionRow([select]).components[0]?.kind, "string_select");
    assert.equal(discordMessageActionRow([users]).components[0]?.kind, "user_select");

    const modal = discordModal({
      customId: "feedback:modal",
      title: "Feedback",
      inputs: [
        discordTextInput({
          customId: "description",
          label: "Description",
          style: "paragraph",
          minimumLength: 10,
        }),
      ],
    });
    assert.equal(modal.rows[0]?.component.maximumLength, 4_000);
    assert.equal(Object.isFrozen(modal), true);
  });

  it("rejects unsafe URLs and structurally invalid rows", () => {
    assert.throws(
      () => discordButton({ style: "link", label: "bad", url: "javascript:alert(1)" }),
      /not allowed/iu,
    );
    assert.throws(
      () =>
        discordButton({
          style: "link",
          label: "too long after normalization",
          url: `https://example.com/${"é".repeat(100)}`,
        }),
      /not allowed/iu,
    );
    assert.throws(
      () =>
        discordMessageActionRow([
          discordUserSelect({ customId: "one" }),
          discordUserSelect({ customId: "two" }),
        ]),
      /own action row/iu,
    );

    const sparse = new Array(1) as unknown as readonly ReturnType<typeof discordSelectOption>[];
    assert.throws(
      () => discordStringSelect({ customId: "unsafe", options: sparse }),
      /dense/iu,
    );
  });
});
