# `@anto-project/discord-bot-core`

Shared technical foundation for Discord-facing Anto-Project processes. The
package gives Antobot and University Platform's UniBot the same hardened
communication primitives without making either product depend on the other.

## Owned technical boundary

- Discord snowflake validation and deterministic interaction correlation;
- safe message payloads with closed mention policy and deterministic nonce;
- provider-neutral embed plans and dynamic colors through the separately
  pinned `@anto-project/dynamic-embed-engine` submodule;
- bounded REST requests, responses, retry and rate-limit handling;
- safe provider receipts and redacted errors;
- application-command projection and idempotent reconciliation;
- explicit interaction and event routers;
- bounded runtime availability/degradation tracking.

The package is stateless with respect to product domains. Credentials,
application IDs, guild/channel policy and handlers are always injected by the
owning process. It does not read environment variables, secrets or files.

## Deliberate non-ownership

This repository contains no Antobot or University business code. In
particular it does not own identity attestation, authorization, capability
manifests, moderation, music, voice rooms, global broadcasts, updates, beta
review, templates, localization, persistence, diagnostics or service-to-
service routing.

Antobot composes its general Discord modules above this core. UniBot composes
only University-specific commands and notices above the same core, with its
own bot credentials and runtime instance. Sharing this package never creates
runtime communication between the two products.

## Secure defaults

- Discord API origin is fixed to `https://discord.com/api/v10`.
- Message mentions are disabled unless an exact user or role allowlist is
  supplied.
- Every message carries a deterministic nonce and `enforce_nonce=true`.
- Request time, response bytes, retry attempts and retry delays are bounded.
- Bot tokens and provider bodies are never included in public errors.
- Routers require explicit bindings; there is no dynamic discovery or
  catch-all handler.

## Submodule consumption

Consumers pin this repository as `vendor/discord-bot-core` recursively and install it with
`"@anto-project/discord-bot-core": "file:vendor/discord-bot-core"`. A clean
checkout bootstraps the submodule before installing/using the consumer:

```bash
git submodule update --init --recursive
npm --prefix vendor/discord-bot-core/vendor/dynamic-embed-engine ci
npm --prefix vendor/discord-bot-core ci
npm ci
```

## Commands

```bash
npm ci
npm run ci
```
