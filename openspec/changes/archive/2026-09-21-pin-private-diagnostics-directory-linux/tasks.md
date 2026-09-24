# Tasks: Pin Private Diagnostics Directory on Linux

## Review Workload Forecast

Slicing/commit structure follows the `chained-pr` and `work-unit-commits` skills: each unit is one deliverable work unit with explicit start/finish/dependencies/follow-up, a suggested Conventional Commit message, and the dependency diagram below.

| Field | Value |
|---|---|
| Estimated changed lines | ≈440–580 total — Unit 1 ≈230–310, Unit 2 ≈210–270 (recalibrated; see evidence below) |
| 400-line budget risk | High as one PR; each stacked unit re-forecasts comfortably under 400 |
| Chained PRs recommended | Yes |
| Decision needed before apply | No — auto-chain proceeds with Unit 1 → Unit 2, stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

**Calibration evidence (read-only):** `git show --stat 3e9f32b7baf26aaed5ab0adebd7e4324f903d2ca` — a commit from blocked PR #25's unpinned P2 dispatch/evidence-integration work — shows +69 lib / +105 test / +1 `package.json` (175 lines) for mode/evidence dispatch wiring without FD-pinning. This sdd-tasks phase has no shell/git tool, so no further PR #25 commits were inspected; this single commit is the calibration anchor. Unit 2 reuses that dispatch shape (grammar, cross-bind) plus Unit 1's primitives (comparable production cost) and adds classification-change/CLI-regression coverage PR #25 lacked (+test lines); it excludes the `package.json` line since this design's file table keeps `package.json` unchanged (declarative-only). Recalibrated Unit 2 ≈210–270. Unit 1 has no historical analog (PR #25 had no FD-pinning); its estimate is structural, scaled to this file's demonstrated one-line-dense style. Both units stay well under 400 — no further split needed.

### Chain Overview

```text
main
 └── 📍 PR 1: pinned primitives/capability/races (Unit 1, apply next)
      └── PR 2: mode/evidence integration, compatibility, regressions (Unit 2)
```

### Suggested Work Units

| Unit | Start → Finish · Depends on · Follow-up | Merge-safe intermediate behavior | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 (PR 1) | Start: current legacy-only verifier. Finish: pinned directory/child/checkpoint primitives added and unit-tested. Depends on: none (P1 `private-local-diagnostics-authorization-lib.mjs` merged, untouched). Follow-up: Unit 2 wires dispatch. | Additive only: `verifyArtifact`/`parseVerificationArgs` untouched, byte-identical legacy behavior; new primitives exported but unreachable from CLI/production dispatch — no partially wired security path | `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` | N/A for the new primitives — not dispatch-reachable until Unit 2; the file's existing CLI-spawn regression test keeps covering only the unchanged legacy path | Revert new exports in `scripts/private-local-diagnostics-verification-lib.mjs`; zero production-behavior change |
| 2 (PR 2) | Start: Unit 1 merged. Finish: legacy routed through Unit 1 primitives plus fully pinned evidence-mode dispatch (parent-spec grammar below) wired end to end. Depends on: Unit 1 merged. Follow-up: none — completes this change's P2 scope. | Evidence mode ships fully pinned from first exposure — never an unpinned intermediate window; legacy stays byte-identical when evidence-free | `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` | `node scripts/verify-private-local-diagnostics-artifact.mjs --artifact-dir <dir> --receipt <name> [--audience hefesto\|optimus --case-id ID [--incident-id ID]]` (exercised by the existing/extended `execFileSync` CLI regression test in the command above) | Revert dispatch/argument changes in `scripts/private-local-diagnostics-verification-lib.mjs`; Unit 1 primitives remain present but unused |

Out of scope for both units (proposal): native helpers/`openat`, CLI redesign, producer changes, host-path resolution, locks/copies/retries, archive execution, network, signer/trust anchor/custody/authenticated approval, P3, build/pack/release/deploy.

## Unit 1: Pinned Primitives, Capability, Races (PR 1)

Suggested commit: `feat(private-diagnostics-verify): add Linux-pinned directory/child read primitives`

Note: here, Linearization "step 1" covers only content/child/sidecar checks, proven against Unit 1's own primitive-level fixtures (legacy five-file shape) — one-clock time-policy and authorization cross-bind checks join step 1 only in Unit 2's task 2.6, which reuses this unit's steps 1–4 ordering/checkpoint mechanism unmodified.

- [x] 1.1 RED — `scripts/verify-private-local-diagnostics-artifact.test.mjs`: capability probe reports unsupported on non-Linux/missing/restricted procfs, supported on Linux+procfs (injected `platform`/`fs` seams), on the new primitive exports directly.
- [x] 1.2 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: add capability probe + `V_CAPABILITY` error class.
- [x] 1.3 RED — acquire/prove: open `O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_NONBLOCK`, require `fstatSync` directory + `/proc/self/fd` (read-only) dev/ino match; alias reopen `ENOENT`/`ELOOP`/`ENOTDIR`/`EACCES`/non-directory/mismatch → `V_DIRECTORY` (JD-001, JD-005).
- [x] 1.4 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: implement pinned-directory acquire/prove, alias identity check, `V_DIRECTORY` mapping, guaranteed FD close in `finally`.
- [x] 1.5 RED — entry stability + child defense: directory stamp `{dev,ino,size,mtimeNs,ctimeNs}`; recorded-absent evidence basename stays expected, no false `V_RACE` (JD-010); every read child's anchored `lstat` equals its retained FD `fstat` + pre-read metadata, incl. legacy five-file members (JD-008).
- [x] 1.6 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: implement stamp capture, basename-state tracking, hardened child open/read/record with retained FDs.
- [x] 1.7 RED — content binding: step-4 order = metadata recheck then offset-0→EOF re-read requiring recorded byte count + SHA-256; append between recheck and re-read → `V_RACE` (JD-011); frozen-timestamp same-size write → `V_RACE` via digest (JD-004).
- [x] 1.8 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: implement content-binding re-read/digest compare after the metadata recheck.
- [x] 1.9 RED — linearization/ABA (against Unit 1's legacy-shape fixtures, generic step 1 only): A→B→A during child reads (poisoned B) → `V_RACE`, B never consumed; held-A caller alias ending at B → `V_DIRECTORY`; ancestor rename after step 3 leaves result unchanged (JD-001, JD-003).
- [x] 1.10 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: implement steps 1–4 ordering (content/child checks → pre-alias recheck → alias dev/ino-only identity → final recheck) with an `onCheckpoint` seam for deterministic injection; keep step 1's check list parameterized so Unit 2 can extend it.
- [x] 1.11 RED — race-window matrix: same-A pair add/remove before step 2 → `V_RACE`; alias renamed-away/replaced/symlinked between steps 2–3 → `V_DIRECTORY`; child write, frozen-timestamp same-size write, rename-replacement, pair add/remove between step 1's last content check and step 3 and between steps 3–4 → `V_RACE`; mutation strictly before a child's step-1 read is input, not a race (JD-006).
- [x] 1.12 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: wire checkpoint hooks at every window named in 1.11.
- [x] 1.13 RED — errno mapping: `EMFILE`/`ENFILE`/`EIO`/`ENOMEM` stay unclassified; every `V_DIRECTORY`/`V_RACE`/`V_CAPABILITY` message omits path/FD/proc-path/metadata/digest (JD-009, JD-012).
- [x] 1.14 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: finalize the error-mapping table and sanitized message text.
- [x] 1.15 Refactor & verify: consolidate/dedupe primitive helpers in `scripts/private-local-diagnostics-verification-lib.mjs` while keeping `verifyArtifact`/`parseVerificationArgs` behavior unchanged; run `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs`.

## Unit 2: Mode/Evidence Integration, Compatibility, Regressions (PR 2)

Suggested commit: `feat(private-diagnostics-verify): wire pinned evidence-mode dispatch and legacy pin-through`

Evidence argument grammar is fixed by the parent spec (`openspec/changes/authorize-private-diagnostics-artifact/specs/private-diagnostics-authorization-evidence/spec.md:11,43`), retained per this change's delta spec ("Retained Parent Requirements"), not an apply-time choice:

- **Activation**: evidence mode activates when either `<artifact-id>.authorization.json`+`.sha256` exist in the (now pinned) inspection directory, or any of `--audience`/`--case-id`/`--incident-id` is supplied; otherwise legacy mode's current 4-argument grammar applies unchanged.
- **Hefesto**: exactly one `--audience hefesto` + exactly one `--case-id CASE_ID` (`SAFE_ID`); any `--incident-id` present is rejected.
- **Optimus**: exactly one `--audience optimus` + one `--case-id CASE_ID` + one `--incident-id INCIDENT_ID` (both `SAFE_ID`), `INCIDENT_ID ≠ CASE_ID`.
- Missing/duplicate/unexpected/mismatched context fails closed (`E_AUTH`); the structural result returns the matched `caseId`/`incidentId`.

- [x] 2.1 RED — `scripts/verify-private-local-diagnostics-artifact.test.mjs`: mode activation via canonical-pathname presence or any evidence-context flag; Hefesto grammar (reject `--incident-id`); Optimus grammar (`SAFE_ID`, `incidentId ≠ caseId`); missing/duplicate/unexpected/mismatched context → `E_AUTH` (JD-007).
- [x] 2.2 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: extend `parseVerificationArgs`/dispatch to detect the canonical authorization pathname (post-receipt, `artifactId` known) and parse `--audience`/`--case-id`/`--incident-id` per the grammar above; either signal activates evidence mode.
- [x] 2.3 RED — legacy dispatch via Unit 1 primitives: exact frozen four-argument grammar, five-file snapshot order/semantics, result, and CLI bytes unchanged (spec: Legacy staged verification is unchanged); mid-verification classification change → `V_RACE` (JD-007).
- [x] 2.4 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: route legacy (stable, evidence-free, no context) through the Unit 1 pinned primitives; preserve exact output.
- [x] 2.5 RED — evidence-mode wiring: complete pair + matching context (Hefesto and Optimus) accepted with unsigned structural output incl. matched `caseId`/`incidentId` (spec: Bound Hefesto evidence is accepted / Pinned bundle); same-audience cross-case/incident mismatch rejected (spec: Same-audience cross-case mismatch is rejected); declarative storage match required, root/locator mismatch rejected (spec: Independently secured copy is accepted / Unsafe inspection or noncanonical storage is rejected); non-Linux/missing/restricted procfs + any evidence-context input → immediate `V_CAPABILITY` (spec: Context requests unavailable evidence mode); no context but complete/partial evidence files observed → `V_CAPABILITY` (spec: Unavailable capability observes evidence).
- [x] 2.6 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: wire `validateAuthorizationPolicy`/`crossBindAuthorization` from `scripts/private-local-diagnostics-authorization-lib.mjs` (read-only) against pinned reads; declarative-only custody check; this extends Unit 1's step 1 with one-clock time-policy and authorization cross-bind checks, reusing 1.10's steps 1–4 ordering/checkpoint mechanism unmodified.
- [x] 2.7 RED — CLI/full regression: existing five-file legacy CLI spawn still reports `not-run-untrusted`; unclassified errno still reaches the wrapper's generic stderr line (JD-009); FIFO/symlink/hardlink/replacement/mutation/short-read/archive-non-execution/cross-bind/replay/time/storage cases unchanged.
- [x] 2.8 GREEN — `scripts/private-local-diagnostics-verification-lib.mjs`: finalize dispatch integration; confirm the CLI wrapper and package.json contracts stay unchanged (no edits to either).
- [x] 2.9 Refactor & verify: consolidate dispatch/evidence-wiring duplication in `scripts/private-local-diagnostics-verification-lib.mjs`; run `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs`.
