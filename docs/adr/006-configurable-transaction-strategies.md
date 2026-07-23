# ADR 006: Configurable Transaction Strategies

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Every transaction tool routes its signing/execution step through a single seam:
`handleTransaction(tx, client, context)` in
`packages/core/src/shared/strategies/tx-mode-strategy.ts`, which picks a strategy based on
`context.mode`. Before this branch that seam was **closed**:

- `AgentMode` had exactly two values — `AUTONOMOUS` and `RETURN_BYTES`.
- The strategy interface (`TxModeStrategy`) and its two implementations (`ExecuteStrategy`,
  `ReturnBytesStrategy`) were internal; there was no supported way for a consumer to inject their own
  signing behaviour.

This blocked a growing set of real integrations:

1. **Remote / institutional signing** — TEEs, MPC threshold networks, KMS/custodial APIs, and
   human-in-the-loop (HITL) approval consoles, where the private key never lives in the agent
   process but the agent still wants a receipt back synchronously.
2. **Two-party / delegated-payer flows** — a service covers the HBAR fee (the *payer*) while the
   user remains the asset owner who must sign (the *subject*). Concretely: an agent pays the
   ~$0.001 network fee so end users transacting in USDC never need to hold HBAR.

The built-in strategies could not express any of these. In particular `ReturnBytesStrategy`
generates the transaction ID from a single `context.accountId`
(`TransactionId.generate(context.accountId)`), so the returned bytes are always
`payer === subject` by construction — the single-party assumption was baked in.

## Decision

Open the strategy seam and make it a first-class extension point, in layers.

### 1. Formalize the strategy contract

- Rename `TxModeStrategy` → **`TransactionStrategy<TResult>`** (generic over the result shape) and
  export it.
- Standardize two typed result envelopes: **`ExecuteStrategyResult`** (`{ raw, humanMessage }`) for
  strategies that execute and return a receipt, and **`ReturnBytesStrategyResult`** (`{ bytes }`) for
  strategies that freeze and return unsigned bytes. The consistent shape is what lets downstream
  consumers (audit hooks, output parsers) treat built-in and user strategies identically.

### 2. Add a pluggable custom mode + context field

- Add `Context.transactionStrategy` — a user-supplied `TransactionStrategy` instance.
- Add `AgentMode.CUSTOM_EXECUTE_TX` and `AgentMode.CUSTOM_RETURN_BYTES` (see §4 below), both
  resolved by `getStrategyFromContext` to `context.transactionStrategy`, with validation (in both
  `getStrategyFromContext` and the `HederaAgentAPI` constructor) that the strategy is present.

The strategy receives the **unfrozen** `Transaction` plus the full `Context`, so it can set the
transaction ID, freeze, sign, add signatures, and/or execute — whatever the integration needs.

### 3. Integrate audit-trail hooks across modes

`HcsAuditTrailHook` and `HolAuditTrailHook` were extended to work in custom mode. Because a custom
executing strategy returns the same `ExecuteStrategyResult` as `AUTONOMOUS`, the hooks log an
identical audit entry with no special-casing. Modes that return bytes are **rejected** by the hooks
(they throw before the tool runs) — no transaction is submitted, so there is no receipt to audit.

### 4. Split custom mode to unblock two-party signing

`CUSTOM` was subsequently split into two explicit modes so the *mode itself* signals the execution
path and carries the correct static return type:

| Mode                  | Strategy returns            | Groups with    |
|-----------------------|-----------------------------|----------------|
| `CUSTOM_EXECUTE_TX`   | `ExecuteStrategyResult`     | `AUTONOMOUS`   |
| `CUSTOM_RETURN_BYTES` | `ReturnBytesStrategyResult` | `RETURN_BYTES` |

`Context.transactionStrategy` is typed as the union of both. Shared predicates
`isReturnBytesMode()` / `isCustomMode()` keep the mode-branching call-sites consistent (EVM tools
skip post-execution lookups on the bytes path; audit hooks reject `CUSTOM_RETURN_BYTES` like
`RETURN_BYTES`; account/prompt resolvers apply subject-account semantics on the bytes path).

This is what makes the requested **delegated-payer** flow expressible entirely in user-land:
- the *build* half is a `CUSTOM_RETURN_BYTES` strategy that stamps
  `setTransactionId(TransactionId.generate(payerAccountId))` (payer injected via the strategy
  constructor; subject read from `context.accountId`), freezes, and returns bytes for the wallet;
- the *submit* half (add the payer signature, execute) is a `CUSTOM_EXECUTE_TX` strategy or an
  ordinary tool.

### 5. Documentation, examples, tests

`docs/TRANSACTION_MODES.md` documents all four modes with reference implementations; HITL
custom-signing example agents were added for LangChain and LangChain v1; unit + integration coverage
was added for strategy resolution, the API validation, and hook behaviour per mode.

Subject-vs-payer orchestration stays in the strategy rather than being baked into the core context
and interface, consistent with the "keep the interface minimal, let strategies own orchestration"
stance of this work. A first-class subject/payer context model remains an additive refinement for
later, not a prerequisite.

## Consequences

**Easier**

- Consumers can plug in remote signing (TEE/MPC/KMS), HITL approval, and two-party / delegated-payer
  flows without forking the SDK.
- Audit-trail hooks work unchanged in `CUSTOM_EXECUTE_TX`; audit invariants stay honest (only
  executed transactions are audited).
- Backward compatible for the shipped modes: `AUTONOMOUS` and `RETURN_BYTES` behaviour is unchanged.

**Harder / tradeoffs**

- `Context` has no index signature, so **per-request** dynamic data (a subject id or user signature
  that varies per call) still has no type-safe channel to the strategy. Static config (e.g. the
  payer account) goes through the strategy constructor; this is sufficient for delegated-payer but is
  a known limitation for richer multi-party cases.
- Subject-vs-payer is not first-class in the core model by design; correctness of the submit side
  (`payerAccountId === expectedPayer`, tx-type allowlists, signature-count defense-in-depth) is the
  consumer's responsibility, in their strategy or tool.
- The `CUSTOM` → `CUSTOM_EXECUTE_TX` / `CUSTOM_RETURN_BYTES` rename is a breaking change to the enum,
  accepted because the feature is unreleased (no deprecated alias kept).

## See also

- `docs/TRANSACTION_MODES.md` — user-facing reference for all four modes.
- `packages/core/src/shared/strategies/tx-mode-strategy.ts`,
  `packages/core/src/shared/configuration.ts` — the strategy contract, modes, and predicates.
- `docs/HOOKS_AND_POLICIES.md` — audit-hook mode support.
