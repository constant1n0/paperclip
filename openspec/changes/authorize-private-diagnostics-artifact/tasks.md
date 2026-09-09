# Tasks: Authorize Private Diagnostics Artifact

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,535–1,640 total, including 595 planning lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | P0a → P0b → P1 → P2 → P3 |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| P0a | Land existing exploration, proposal, and spec | 259–259 lines | Start: untracked planning; finish: approved scope/spec on main; verify Markdown links/JD-001..005; rollback: revert P0a. |
| P0b | Land design, review ledger, and this checklist | 336–336 lines | Base: merged P0a; finish: approved executable plan; verify ledger/forecast; rollback: revert P0b. |
| P1 | Evidence contract, parser, sidecar, cross-binding | 330–350 lines | Base: merged P0b; tests travel with code; rollback: revert new module/helper exports. |
| P2 | Dual-mode static verifier and CLI/result docs | 350–395 lines | Base: merged P1; no untrusted execution; rollback: revert wiring/docs, retaining legacy verifier. |
| P3 | HUMAN-OPS manual boundary and regressions | 260–300 lines | Base: merged P2; docs/tests only; rollback: revert manual/tests. |

Retain every branch; each merge needs separate owner authorization. Do not begin a child PR before its predecessor merges.

## Phase 1: Planning Adoption (P0a → P0b)

- [x] 1.1 P0a: add `exploration.md`, `proposal.md`, and `specs/private-diagnostics-authorization-evidence/spec.md`; verify JD-001..005 remain verified and no runtime scope is introduced.
- [x] 1.2 P0b: add `design.md`, `review-ledger.md`, and `tasks.md`; verify hybrid artifact parity, P1 `<=350`, P3 `<=300`, and every PR estimate remains under 400 changed lines.

## Phase 2: Evidence Contract (P1)

- [ ] 2.1 RED: add contract cases in `scripts/private-local-diagnostics-authorization-lib.test.mjs` for closed/canonical JSON, UTC, hashes, bytes, sidecar, and Hefesto/Optimus incident rules.
- [ ] 2.2 Create `scripts/private-local-diagnostics-authorization-lib.mjs`; export pure parser, one-policy validator, cross-binding, canonical custody strings, and sidecar helpers—no signer, fetch, custody parser, or host-path resolution.
- [ ] 2.3 Update `scripts/private-local-diagnostics-artifact-lib.mjs` only for reusable safe helpers; prove `receipt` v1 null slots and five-file producer bytes/semantics remain unchanged in its tests.

## Phase 3: Static Verification (P2)

- [ ] 3.1 RED: extend `scripts/verify-private-local-diagnostics-artifact.test.mjs` for exact legacy result, partial/context-only rejection, replay, interval boundaries, independent inspection, and malicious archive non-execution.
- [ ] 3.2 Update `scripts/private-local-diagnostics-verification-lib.mjs` and `scripts/verify-private-local-diagnostics-artifact.mjs` for exact legacy grammar or complete evidence mode; leave legacy `snapshot()` byte-for-byte/behaviorally unchanged, while evidence mode uses a separate hardened snapshot/recheck helper for every inspected file; capture `clock` once and return only `authorizationEvidence: "unsigned"` with matched context.
- [ ] 3.3 Update `package.json` CLI/result documentation; reject `--require-authorized`, unknown/duplicate inputs, and all authenticated-authorization claims.

## Phase 4: HUMAN-OPS Boundary (P3)

- [ ] 4.1 Update `docs/central-local-diagnostics-operator-manual.md`: distinguish human case approval from unsigned evidence; record custody migration, backup/restore, and immutability as HUMAN-OPS evidence only, with no runtime acceptance or Placa B mutation claim.
- [ ] 4.2 Add focused integration/regression cases in `scripts/private-local-diagnostics-{verification-lib,artifact-lib,producer-lib}.test.mjs` for five-file stability, no custody-record parser, and publication/build/pack/fetch/signing exclusions.
