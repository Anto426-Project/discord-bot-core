# ADR-0001: Domain-neutral Discord core

Status: accepted

## Context

Antobot and UniBot are separate Discord identities owned by separate product
domains. Both need the same low-level safety mechanisms, but sharing product
handlers, credentials, authorization or delivery policy would recreate a
forbidden domain coupling.

## Decision

`@anto-project/discord-bot-core` is a code-only library. It owns provider
transport safety, bounded retry/rate-limit behavior, closed payload
projection, command/event routing and runtime lifecycle primitives. Dynamic
palette and embed-plan mechanics are owned by the separately versioned
`dynamic-embed-engine` submodule and re-exported for bot consumers. Product
processes inject all identity, destination and business decisions.

The package is not a service. It has no service key, listener, database,
runtime lease, diagnostics endpoint, environment reader or private key.
Antobot and UniBot pin the package independently as a Git submodule and never
share live state or credentials.

## Consequences

- security fixes can be applied once and adopted by both processes;
- Antobot retains its complete general-purpose feature set above the core;
- UniBot remains a small University-owned adapter/runtime;
- no shared API can create a trusted human actor or authorize a business
  action;
- provider failure changes delivery state only and cannot mutate product
  business state.
