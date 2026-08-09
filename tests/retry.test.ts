import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeWithDiscordRetry } from "../src/index.js";

describe("bounded Discord retry", () => {
  it("never retries earlier than a provider Retry-After", async () => {
    const failure = new Error("rate limited");
    let attempts = 0;
    await assert.rejects(
      () =>
        executeWithDiscordRetry({
          operation: async () => {
            attempts += 1;
            throw failure;
          },
          decide: () => ({ retry: true, retryAfterMs: 30_000 }),
          policy: { maximumAttempts: 3, baseDelayMs: 10, maximumDelayMs: 5_000 },
          sleep: async () => {
            throw new Error("must not sleep below provider delay");
          },
        }),
      failure,
    );
    assert.equal(attempts, 1);
  });

  it("uses the larger exponential/provider delay within policy", async () => {
    const sleeps: number[] = [];
    let attempts = 0;
    const result = await executeWithDiscordRetry({
      operation: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("retry");
        return "ok";
      },
      decide: () => ({ retry: true, retryAfterMs: 500 }),
      policy: { maximumAttempts: 2, baseDelayMs: 100, maximumDelayMs: 1_000 },
      sleep: async (delay) => {
        sleeps.push(delay);
      },
    });
    assert.equal(result, "ok");
    assert.deepEqual(sleeps, [500]);
  });
});
