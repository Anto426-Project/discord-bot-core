# `@anto-project/discord-bot-core`

Shared technical foundation for Discord-facing Anto-Project processes. The
package gives Antobot and University Platform's UniBot the same hardened
communication primitives without making either product depend on the other.
`discord.js` is an internal implementation detail of the Node adapter: product
code consumes only the ports and immutable DTOs exported by this package.

## Owned technical boundary

- Discord snowflake validation and deterministic interaction correlation;
- safe message plans with embeds, interactive action rows, closed mention policy
  and deterministic nonce;
- provider-neutral embed plans and dynamic colors through the separately
  pinned `@anto-project/dynamic-embed-engine` submodule;
- provider-managed REST buckets and global rate-limit coordination;
- safe provider receipts and redacted errors;
- application-command projection and ownership-safe reconciliation;
- explicit interaction and event routers;
- an opaque, generation-aware provider-extension host for concrete technical
  adapters such as music playback, without exposing the SDK client;
- bounded runtime availability/degradation tracking.

The package is stateless with respect to product domains. Credentials,
application IDs, guild/channel policy and handlers are always injected by the
owning process. It does not read environment variables, secrets or files.

## Deliberate non-ownership

This repository contains no Antobot or University business code. In
particular it does not own identity attestation, authorization, capability
manifests, global broadcasts, updates, beta review, templates, localization,
persistence, diagnostics or service-to-service routing. Low-level provider
operations may live here behind stable ports; the owning product still decides
who may invoke them, for which destination, and with which business policy.

Antobot composes its general Discord modules above this core. UniBot composes
only University-specific commands and notices above the same core, with its
own bot credentials and runtime instance. Sharing this package never creates
runtime communication between the two products.

## Secure defaults

- Discord API origin is fixed to `https://discord.com/api/v10`.
- Message mentions are disabled unless an exact user or role allowlist is
  supplied.
- Every message carries a deterministic nonce and `enforce_nonce=true`.
- Outbound messages and interaction responses share one fail-closed component
  encoder; provider action-row shapes never enter product code.
- Direct-message delivery classifies a recipient as unreachable only for the
  provider's explicit cannot-message error code; other forbidden responses stay
  generic provider failures.
- SDK request time and retry attempts are bounded; provider Retry-After values
  are never shortened into an early retry.
- Bot tokens and provider bodies are never included in public errors.
- Routers require explicit bindings; there is no dynamic discovery or
  catch-all handler.
- Public declaration files contain no `discord.js` or `@discordjs/*` types.
- Extensions register before lifecycle start, release before client destroy,
  and remain quarantined after a failed or timed-out cleanup; a stale
  generation can never be rebound over a cleanup still in flight.

## Submodule consumption

Consumers pin this repository as `vendor/discord-bot-core` recursively, list
that path in the owning repository's npm `workspaces`, and depend on
`"@anto-project/discord-bot-core": "workspace:*"`. The workspace is important:
it lets npm install the core's private provider dependencies without declaring
them directly in Antobot or UniBot. Generated package entrypoints are tracked,
so a clean recursive checkout is consumable without running lifecycle scripts
inside the dependency:

```bash
git submodule update --init --recursive
npm ci
```

Run `npm --prefix vendor/discord-bot-core ci` only when developing or testing
the core itself.

## Commands

```bash
npm ci
npm run ci
```
