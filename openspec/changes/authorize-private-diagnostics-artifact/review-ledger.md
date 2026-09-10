# Review Ledger: Authorize Private Diagnostics Artifact

## Design review — round 1

Target: `exploration.md`, `proposal.md`, capability spec, and `design.md` before task planning.
Review mode: automatic design gate plus Judgment Day blind Judges A and B.

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| JD-001 | judgment-day | `exploration.md:40-47`; `spec.md:9-24`; `design.md:18-27` | BLOCKER | verified | Both scoped re-judges and the automatic design gate verified that explicit modes preserve legacy five-file verification and fail closed on partial evidence/context. |
| JD-002 | judgment-day | `exploration.md:77-80`; `spec.md:75-91`; `design.md:67-79` | CRITICAL | verified | Both scoped re-judges and the automatic design gate verified that inspection location is independent from declarative Placa B custody metadata. |
| JD-003 | judgment-day | `exploration.md:81-83`; `spec.md:61-75`; `design.md:27,39-40` | CRITICAL | verified | Both scoped re-judges and the automatic design gate verified one captured clock and `issuedAt <= verificationTime < expiresAt`. |
| JD-004 | judgment-day | `exploration.md:45-46,81-83`; `spec.md:43-60`; `design.md:25-29,45-46` | CRITICAL | verified | Both scoped re-judges and the automatic design gate verified exact audience/case/incident binding and distinct Optimus incident context. |
| JD-005 | judgment-day | `exploration.md:85`; `spec.md:75-91`; `design.md:62-64` | CRITICAL | verified | Both scoped re-judges and the automatic design gate verified an honest documentation-only/HUMAN-OPS custody-evidence boundary. |
| JD-006 | judgment-day | `design.md:53` | CRITICAL | info | Judge A alone raised incomplete ancestor-directory pinning. Suspect only; it does not drive automatic fixes in this round. |
| JD-007 | judgment-day | `design.md:33-40`; operator manual `:271-284` | CRITICAL | info | Judge A alone raised collision between structural `authorization: "unsigned"` and the manual's human-case `authorized: true`. The independent design gate also treats this as a required correction, but it is not Judgment-Day-confirmed. |
| JD-008 | judgment-day | `proposal.md:3-5,28-30`; `design.md:29-40` | CRITICAL | info | Judge B alone challenged the term tamper-evident because an unsigned manifest plus recomputable sidecar has no trust anchor. Suspect only; it does not drive automatic fixes in this round. |

## Automatic gatekeeper corrections

- Preserve two explicit modes: unchanged five-file staged verification, and authorization-evidence verification activated by complete evidence plus explicit expected context. Partial evidence must fail closed.
- Validate custody locator as declarative canonical metadata; apply filesystem/link/TOCTOU checks only to the supplied inspection directory and its files.
- Capture one verification instant and require `issuedAt <= verificationTime < expiresAt`.
- Bind explicit expected case and, for Optimus, a distinct incident identifier; return them in the structural result.
- Make custody evidence either a mechanically validated contract or a documentation-only HUMAN-OPS schema without runtime acceptance claims.
- Distinguish human case approval from unsigned structural artifact evidence in the behavior-changing slice.

## Budget

Fix round 1 of at most 2. Re-review must use only this ledger and the fix diff.

## Round 1 fix diff

This section is the authoritative scoped fix diff for re-review because the planning artifacts are untracked.

### JD-001 — legacy/evidence mode compatibility

- **Current fix:** `exploration.md:37-42`; `proposal.md:10-12,31`; `spec.md:9-23`; `design.md:20-32,72-73`.
- **Before:** Verification always required seven files and `--audience`, replacing the existing five-file two-argument contract.
- **After:** No evidence files/context preserves the exact legacy five-file path and result; any evidence file/context selects a complete-or-reject evidence mode.

### JD-002 — independent inspection versus custody metadata

- **Current fix:** `exploration.md:70-74,77-79`; `proposal.md:13,31,51`; `spec.md:73-87`; `design.md:15,38,66,76`.
- **Before:** The inspected directory had to equal or resolve from the Placa B custody locator.
- **After:** `--artifact-dir` remains independently secured and arbitrary; fixed custody root/locator values are declarative canonical strings only and are never resolved on the verifier host.

### JD-003 — complete validity interval

- **Current fix:** `exploration.md:72`; `proposal.md:50`; `spec.md:57-71`; `design.md:14,32,75`.
- **Before:** Policy checked expiry without requiring the evidence to have been issued at verification time.
- **After:** Evidence mode captures one verification instant and requires `issuedAt <= verificationTime < expiresAt`.

### JD-004 — exact case and incident binding

- **Current fix:** `exploration.md:42,57-63,72,87-88`; `proposal.md:12,49,64`; `spec.md:25-55`; `design.md:13,27,32,38,43-51,74-75`.
- **Before:** Case and break-glass incident were not closed, distinct, or exact verifier expectations, permitting same-audience replay.
- **After:** `incidentId` is closed (`null` for Hefesto; nonempty/distinct for Optimus); expected context exact-matches audience/case/incident and the structural result returns case/incident.

### JD-005 — custody-evidence boundary

- **Current fix:** `exploration.md:74,79,89`; `proposal.md:18`; `spec.md:75`; `design.md:5,36,54,87,93`.
- **Before:** Planning described a custody record with observable runtime acceptance or validation despite design stating Paperclip would not enforce it.
- **After:** Custody evidence is explicitly documentation-only/HUMAN-OPS, with no parser, runtime acceptance, validation, result field, enforcement, or scenario in this change.

### Automatic gate — human approval versus unsigned structural evidence

- **Current fix:** `exploration.md:17,72,88`; `proposal.md:5,14,31,48`; `spec.md:29-33,89-103`; `design.md:16,27,40-54,63,78,86`.
- **Before:** Structural `authorization: "unsigned"` could semantically collide with HUMAN-OPS `authorized` human case approval.
- **After:** CLI/result documentation in the verifier slice reserves `authorizationEvidence: "unsigned"` for unsigned structural evidence; it never reports or satisfies human case approval.

## Round 1 scoped re-review

- Judge A: JD-001 through JD-005 and the terminology correction verified; `JUDGMENT: APPROVED`.
- Judge B: JD-001 through JD-005 and the terminology correction verified; `JUDGMENT: APPROVED`.
- Automatic design gate: all six corrections passed; no blocking inconsistency in fix-touched lines.
- JD-006 and JD-008 remain first-pass informational signals and do not block task planning. JD-007 remains informational; its independently required terminology correction is verified.

**JUDGMENT: APPROVED**

## P0a post-apply review — round 1

Target: the 259-line P0a review bundle (`exploration.md`, `proposal.md`, and capability spec).

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| P0A-JD-001 | judgment-day | `exploration.md:42,72,77,84,88`; `proposal.md:5,31,49,59`; `spec.md:43,91` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified honest structural-integrity/self-consistency language and the unsigned remint boundary. |
| P0A-JD-002 | judgment-day | `exploration.md:39-40,70,87-88`; `proposal.md:10,31`; `spec.md:11,27` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified the exact canonical manifest/sidecar filenames, bytes, discovery and completeness rules. |
| P0A-JD-003 | judgment-day | `exploration.md:42,87`; `proposal.md:31,64`; `spec.md:27,43` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified one shared nonempty bounded ASCII `SAFE_ID` grammar for case and incident identifiers. |
| P0A-JD-004 | judgment-day | `exploration.md:42,88`; `proposal.md:12,31,64`; `spec.md:43` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified exact fail-closed Hefesto/Optimus context grammars. |

The independent automatic apply gate passed branch/base/scope/budget/task-state checks. These four Judgment Day findings block commit/PR readiness.

Fix round 1 of at most 2 for P0a. Scoped re-review must use these rows and the persisted P0a fix diff only.

## P0a fix round 1 — authoritative scoped diff

This is the authoritative P0a fix diff for scoped re-review; ranges refer to the corrected, current three-file review bundle.

### P0A-JD-001 — unsigned structural-integrity boundary

- **Current fix:** `exploration.md:42,72,77,84,88`; `proposal.md:5,31,49,59`; `spec.md:43,91`.
- **Before:** “Tamper-evident” and replay-prevention wording could imply that unsigned evidence resists an attacker who rewrites the complete bundle.
- **After:** The bundle proves structural integrity/self-consistency only. Expected context rejects mismatched or stale use, not cryptographic replay; an attacker who can rewrite the unsigned bundle can remint manifest and sidecar. Only a future external trust anchor/signature can authenticate owner intent or resist that attack.

### P0A-JD-002 — canonical sidecar pair

- **Current fix:** `exploration.md:39-40,70,87-88`; `proposal.md:10,31`; `spec.md:11,27`.
- **Before:** Sidecar bytes were specified but the canonical pathname and its role in discovery/pair completeness were ambiguous.
- **After:** Evidence mode recognizes only `<artifact-id>.authorization.json` and `<artifact-id>.authorization.json.sha256`; the sidecar contains exactly `<lowercase-sha256><two spaces><artifact-id>.authorization.json\n`.

### P0A-JD-003 — safe case identifier

- **Current fix:** `exploration.md:42,87`; `proposal.md:31,64`; `spec.md:27,43`.
- **Before:** Manifest and expected `caseId` were exact-match values but not normatively constrained to a shared safe, nonempty grammar.
- **After:** Both use `SAFE_ID = [A-Za-z0-9][A-Za-z0-9_-]{0,127}`: nonempty, ASCII-only, bounded to 128 characters, and rejecting control/path characters. Optimus incident values use the same grammar.

### P0A-JD-004 — exact evidence-mode context grammar

- **Current fix:** `exploration.md:42,88`; `proposal.md:12,31,64`; `spec.md:43`.
- **Before:** Hefesto did not explicitly reject an incident argument, and duplicate/unexpected context was not closed.
- **After:** Hefesto accepts exactly one audience plus case and rejects any incident; Optimus accepts exactly one audience, case, and distinct incident. Missing, duplicate, unexpected, or manifest-mismatched context fails closed.

## P0a gate execution incident

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| R4-001 | resilience | P0a scoped `sdd-verify` prompt artifact-path block | WARNING | info | Relative paths were resolved from the OpenClaw checkout instead of `/home/dcm/paperclip/_build-722`, producing an invalid missing-directory result. Fresh audit verified no mutation. All rerun prompts must set the Paperclip workdir and use absolute artifact paths. |

## P0a round 1 scoped re-review

- Judge A: P0A-JD-001 through P0A-JD-004 verified; `JUDGMENT: APPROVED`.
- Judge B: P0A-JD-001 through P0A-JD-004 verified; `JUDGMENT: APPROVED`.
- Corrected automatic gate: passed the four fixes, 259-line budget, branch/base, P0a status and no-publication boundary.
- R4-001 remains informational; its invalid result was not reused and the rerun used absolute Paperclip paths.

**P0a JUDGMENT: APPROVED**

## P0a PR #22 CI incident audit

### Reliability findings ledger

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|

No P0a reliability defect was established.

- `Verify serialized server suites (4/5)` failed in `server/src/__tests__/issue-onboarding-first-task-routes.test.ts` teardown, not in a behavioral assertion.
- PostgreSQL FK `23503` showed queued heartbeat work still referenced `agent_wakeup_requests` and `agents` while teardown deleted them; concurrent logs reported database shutdown.
- P0a changes only three new OpenSpec planning files. All other server shards, build, typecheck, E2E, canary, policy and final verification checks passed.
- Authorized response: rerun only the failed job once. The rerun passed in 3m44s, classifying the occurrence as transient test isolation. All PR checks are green; recurrence in a future run still requires a separate teardown-synchronization fix.

## P0b post-apply review — round 1

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| P0B-JD-001 | judgment-day | `design.md:30,66`; `tasks.md:44-45`; `spec.md:75` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified evidence-only hardening while legacy `snapshot()` and its five-file sequence remain byte-for-byte/behaviorally unchanged. |
| P0B-JD-002 | judgment-day | `proposal.md:33`; `design.md:85-89`; `tasks.md:23-27`; `apply-progress.md:25,32` | CRITICAL | verified | Both scoped re-judges and the corrected automatic gate verified P1 `330-350`, P3 `260-300`, no exception and the recalculated forecast. |
| P0B-JD-003 | judgment-day | `design.md:32,38,74`; `tasks.md:38,44-46`; `spec.md:27,43` | CRITICAL | info | Suspect only: Judge A found that the design/tasks do not state the exact shared `SAFE_ID` constraint for case and incident values. Judge B and the independent gate did not confirm it; it does not drive automatic fixes. |
| P0B-JD-004 | judgment-day | `design.md:32,38,47-48,74-75`; `spec.md:27,43` | CRITICAL | info | Suspect only: Judge B found that the design does not explicitly bind Hefesto to `normal` and Optimus to `break-glass`. Judge A and the independent gate did not confirm it; it does not drive automatic fixes. |
| P0B-JD-005 | judgment-day | `proposal.md:14,19,33`; `design.md:63,87,93`; `tasks.md:46,48-50` | CRITICAL | info | Suspect only: Judge B found conflicting placement for CLI/result documentation versus the excluded operator-manual edit. Judge A and the independent gate did not confirm it; it does not drive automatic fixes. |
| P0B-JD-006 | judgment-day | `review-ledger.md:12-17` | WARNING | info | Judge B noted stale historical line anchors. This is a first-pass traceability signal, not a P0b blocking defect. |

- Confirmed: 2; suspect: 3; informational: 1; contradictions: 0.
- Automatic gate independently failed P0B-JD-002 and otherwise confirmed branch/base, 299-line bundle, task state, documentary scope and non-publication state.

**P0b round 1 JUDGMENT: REJECTED**

## P0b fix round 1 — authoritative scoped diff

This section is the authoritative scoped fix diff for re-judges; ranges refer to the corrected P0b bundle only.

### P0B-JD-001 — evidence-only filesystem hardening

- **Current fix:** `design.md:15,23-27,30,66,77`; `tasks.md:45`.
- **Before:** The plan attributed single-link, `lstat`/`fstat` device+inode, timestamp, and final-path rechecks to the legacy snapshot even though its current implementation lacks them; shared hardening would alter legacy behavior.
- **After:** Legacy `snapshot()` and its five-file call sequence remain byte-for-byte/behaviorally unchanged. Evidence mode alone uses an isolated hardened snapshot/recheck helper for every inspected file, with deterministic injected filesystem/clock test seams.

### P0B-JD-002 — approved slice budgets and planning arithmetic

- **Current fix:** `tasks.md:7,24-27,34,45`; `apply-progress.md:13,20,25,32`.
- **Before:** P1 was `330–380` and P3 `260–330`, exceeding their approved `<=350` and `<=300` maxima; progress nevertheless claimed validated forecasts.
- **After:** P1 is `330–350` and P3 `260–300`, with P0b recalculated to 336 lines and the total plan to `1,535–1,640`, including 595 planning lines. No size exception is authorized.

## P0b round 1 scoped re-review

- Judges A and B verified P0B-JD-001/P0B-JD-002 with no new fix-line finding; both returned `JUDGMENT: APPROVED`.
- The corrected automatic gate passed the 336-line bundle, arithmetic, branch/base, task state and no-publication checks. **P0b JUDGMENT: APPROVED**

## P1 clean-room post-apply review — round 1

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| P1R-GATE-001 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.mjs:4-31,38-47`; receipt identity at `scripts/private-local-diagnostics-artifact-lib.mjs:94-101` | CRITICAL | fixed | `artifactId` now uses the receipt v1 safe-basename grammar, accepts dotted production versions, and still derives exact filenames, fixed locator, and bindings. |
| P1R-GATE-002 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.test.mjs:39-51`; `spec.md:59` | CRITICAL | fixed | Deterministic policy coverage accepts exactly `issuedAt`, rejects one nanosecond before, and rejects exact expiry. |
| P1R-JD-001 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.mjs:3-31` | CRITICAL | fixed | Absolute full-string matching now rejects terminal LF/CRLF in hashes, IDs, RFC3339 timestamps, and bounded references. |
| P1R-JD-002 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.mjs:62-65` | CRITICAL | fixed | The sidecar must equal its exact constructed bytes, rejecting extra terminal newlines. |
| P1R-JD-003 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.test.mjs:25-46` | WARNING | info | The judges identified additional non-blocking negative-coverage gaps, including nested/prototype fields, unsafe bytes, and custody/revocation values. |
| P1R-JD-004 | judgment-day | `scripts/private-local-diagnostics-authorization-lib.mjs:25-29` | WARNING | info | Judge A noted `Date.UTC` remaps years 0000-0099. This is an exact-RFC3339 edge signal, not a confirmed blocking finding. |

- Confirmed gate blockers: 2; single-judge suspects: 2; informational warnings: 2.
- Judge A: `JUDGMENT: REJECTED`; Judge B: `JUDGMENT: APPROVED`; static automatic gate: `fail`.

**P1 clean-room round 1 JUDGMENT: REJECTED**

## P1 clean-room fix round 1 — authoritative scoped ranges

- **P1R-GATE-001:** `scripts/private-local-diagnostics-authorization-lib.mjs:4-31,38-47`; `scripts/private-local-diagnostics-authorization-lib.test.mjs:5-46`.
- **P1R-GATE-002:** `scripts/private-local-diagnostics-authorization-lib.test.mjs:49-52`.
- **P1R-JD-001:** `scripts/private-local-diagnostics-authorization-lib.mjs:3-31`; `scripts/private-local-diagnostics-authorization-lib.test.mjs:43-46`.
- **P1R-JD-002:** `scripts/private-local-diagnostics-authorization-lib.mjs:62-65`; `scripts/private-local-diagnostics-authorization-lib.test.mjs:34`.
- Judges A and B independently verified all four fixed rows with no new fix-line finding; both returned `JUDGMENT: APPROVED`.
- The fresh automatic gate verified all four rows, the 350-line ceiling and no-publication scope; `gate: pass`.
- P1R-JD-003/004 remain informational and untouched.

**P1 clean-room fix round 1 JUDGMENT: APPROVED**

## P1 runtime finish CLI incident

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| R4-001 | resilience | `gentle-ai` v2.2.0 `sdd-attempt finish`; installed `internal/cli/sdd_attempt.go:154-159` | WARNING | info | A first close command supplied unsupported `--changed-lines`; validation rejected it before opening the runtime store. The CLI measures changed lines internally. The attempt remained running at the same revision and is safe to finish without that flag. |

## P1 pre-commit reliability review

- Findings ledger: empty.
- One exhaustive reliability sweep returned `PRE-COMMIT: PASS`.
