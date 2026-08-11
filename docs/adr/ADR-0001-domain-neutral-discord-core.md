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

The concrete Discord SDK is a private dependency of the Node adapter. Public
package contracts use only core-owned DTOs and ports. This allows the SDK to be
upgraded or replaced without spreading provider classes through product code.
Low-level provider operations may be implemented by the core, while fan-out,
destination selection, templates, localization, authorization and delivery
policy remain in their owning product.

Concrete provider extensions register through an opaque host port before the
gateway lifecycle starts. The internal client is bound with a monotonic
generation and released, with a deadline, before that generation is destroyed.
Failed or incomplete release is quarantined and blocks rebinding; products
never receive the client or the private extension protocol. A callback-only
factory constructs that opaque protocol object inside this package; the owning
product invokes and composes companion technical cores, while this package
never calls a product use case or another core autonomously.

Inspection, guild-directory, profile and presence ports read only the currently
owned client generation. Provider fetches are bounded by a total deadline and
in-flight capacity. Shutdown aborts the public waiters, and a result captured
from an older client is rejected even if its SDK operation settles after a
restart. Profile assets are fully materialized as primitive HTTPS CDN URLs;
provider objects and lazy callbacks never cross the adapter boundary.

The package is not a service. It has no service key, listener, database,
runtime lease, diagnostics endpoint, environment reader or private key.
Antobot and UniBot pin the package independently as a Git submodule and never
share live state or credentials.

## Consequences

- security fixes can be applied once and adopted by both processes;
- Antobot retains its complete general-purpose feature set above the core;
- UniBot remains a small University-owned adapter/runtime;
- Antobot and UniBot never gain a runtime dependency on one another by sharing
  code;
- no shared API can create a trusted human actor or authorize a business
  action;
- provider failure changes delivery state only and cannot mutate product
  business state.

This is an implementation choice compatible with the architecture master,
not a new authority described by it. Protected cross-domain business calls
continue to pass through AccessBroker and never fall back to a direct
Antobot-to-University connection.
