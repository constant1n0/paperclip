# Apply Progress: Pin Private Diagnostics Directory on Linux

**Mode**: Strict TDD
**Scope executed**: Unit 1 (tasks 1.1–1.15, across two attempts — attempt 1 settled `failed` by the parent spot check with 5 verified design deviations, attempt 2 fixed all 5) plus two later Greptile PR #26 review-fix work units (all merged into `master` at `2aafc3026`, see the two dedicated sections near the end of this file), and now Unit 2 (tasks 2.1–2.9, this apply batch) plus one carried-over coverage task (JD-DESIGN-008 `recheckPinnedChild` isolation gap). Unit 2 is complete; this change's P2 scope is now fully implemented.

## Completed Tasks

- [x] 1.1 RED — capability probe test (unsupported/supported, injected `platform`/`fs` seams)
- [x] 1.2 GREEN — capability probe + `V_CAPABILITY` error class
- [x] 1.3 RED — acquire/prove + alias-reopen failure-mode test
- [x] 1.4 GREEN — pinned-directory acquire/prove, alias identity check, `V_DIRECTORY` mapping, guaranteed FD close
- [x] 1.5 RED — entry stability + child defense test (recorded-absent stays expected; child metadata drift)
- [x] 1.6 GREEN — directory stamp capture, basename-state tracking, hardened child open/read/record with retained FDs
- [x] 1.7 RED — content-binding test (append after recheck; frozen-timestamp same-size mutation)
- [x] 1.8 GREEN — content-binding re-read/digest compare after metadata recheck
- [x] 1.9 RED — linearization/ABA test (poisoned-B rename, ancestor rename after step 3)
- [x] 1.10 GREEN — steps 1–4 ordering with `onCheckpoint` seam; step-1 check list parameterized via `entries`
- [x] 1.11 RED — race-window matrix test (presence flip, alias tampering, same-A child replacement, pre-read mutation is input)
- [x] 1.12 GREEN — checkpoint hooks confirmed wired at every window named in 1.11 (built generically in 1.10; no additional prod change needed)
- [x] 1.13 RED — errno-mapping test (EMFILE/ENFILE/EIO/ENOMEM unclassified; V_ messages contain no secrets)
- [x] 1.14 GREEN — error-mapping/`classify` helper confirmed correct (built in 1.2/1.4/1.6/1.8; no additional prod change needed)
- [x] 1.15 Refactor & verify — extracted `openDirectoryHandle` (shared by acquire/alias-prove) and `childPath` (shared anchored-path builder); full focused suite green

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `scripts/private-local-diagnostics-verification-lib.mjs` | Modified (additive only, plus attempt-2 fixes) | Added new Linux-pinned-directory primitives: `detectPinnedDirectoryCapability`, `requirePinnedDirectoryCapability`, `acquirePinnedDirectory`, `proveDirectoryAlias`, `verifyPinnedDirectory` (steps 1–4 orchestrator), plus internal helpers (`classifyBasename`, `readPinnedChild`, `recheckPinnedChild`, `readChildToEnd`, `verifyChildContent`, `captureDirectoryStamp`, `openDirectoryHandle`, `childPath`, `classify`). Attempt 2 fixed: basename validation in `verifyPinnedDirectory` (Finding 1), static-vs-race error classification in `readPinnedChild` (Findings 2/3), and absolute-path/final-symlink/canonicalization in `acquirePinnedDirectory` (Finding 4). `verifyArtifact`/`parseVerificationArgs` bodies are byte-identical (only the `node:fs` import line gained `readSync`/`statSync`, already present from attempt 1 — `realpathSync`/`isAbsolute` were already imported). None of the new exports are called from `verifyArtifact`, `parseVerificationArgs`, or the CLI wrapper — unreachable from production dispatch as required. |
| `scripts/verify-private-local-diagnostics-artifact.test.mjs` | Modified (additive only) | Attempt 1 added 10 new tests covering tasks 1.1–1.14. Attempt 2 added 6 more new tests (basename validation, static-child classification, 4 acquisition/canonicalization tests) covering Findings 1, 2/3, and 4 — file now has 19 `test()` calls total (3 pre-existing legacy tests + 16 new pinned-directory tests). All tests pass; no test was deleted or weakened. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `verify-private-local-diagnostics-artifact.test.mjs` | Unit | ✅ 5/5 (baseline) | ✅ Written — `SyntaxError: does not provide an export` confirmed before impl | ✅ Passed | ✅ 3 cases (darwin-unsupported, linux-EACCES-unsupported, linux-supported) + capability-guard throw | ✅ Clean |
| 1.3/1.4 | same | Unit | ✅ carried from 1.2 | ✅ Written — failed on missing export, then on `^...$` anchor mismatch (fixed to match codebase's unanchored-regex convention) | ✅ Passed | ✅ 4 cases (acquire success, alias success, alias-mismatch dir, alias-missing-path, acquire-missing-path, acquire-non-directory) | ✅ Clean |
| 1.5/1.6 | same | Unit | ✅ carried | ✅ Written — failed on missing `verifyPinnedDirectory` export | ✅ Passed | ✅ 2 cases (recorded-absent stays absent + success; child metadata drift → V_RACE) | ✅ Clean |
| 1.7/1.8 | same | Unit | ✅ carried | ✅ Written — failed pre-impl (same missing-export RED as 1.5) | ✅ Passed | ✅ 2 cases (append-after-recheck; frozen-timestamp same-size mutation via memoizing lstat/fstat seam) | ✅ Clean |
| 1.9/1.10 | same | Unit | ✅ carried | ✅ Written — 1 sub-case genuinely failed on first run (poisoned-rename injected at wrong checkpoint window: caught earlier as V_RACE via directory ctime bump on rename, not V_DIRECTORY at step 3); corrected the injection point to `step2-complete` and reran | ✅ Passed after test correction (no production code change needed — steps 1–4 pipeline already built generically in 1.6/1.8) | ✅ 2 cases (ABA/poison rejected + B never consumed; ancestor rename after step 3 leaves result unchanged) | ➖ None needed |
| 1.11/1.12 | same | Unit | ✅ carried | ✅ Written — passed on first run against the already-generalized pipeline (checkpoint seam covers every named window) | ✅ Passed | ✅ 3 cases (presence-flip add, alias renamed-away / renamed-away+replaced, same-A rename-replacement + pre-read-mutation-is-input) | ➖ None needed |
| 1.13/1.14 | same | Unit | ✅ carried | ✅ Written — passed on first run against the already-implemented `classify` errno gate | ✅ Passed | ✅ 4 raw-errno cases (EMFILE/ENFILE/EIO/ENOMEM through both `acquirePinnedDirectory` and `verifyPinnedDirectory`) + 3 message/no-leak assertions | ➖ None needed |
| 1.15 | same | Unit | ✅ 13/13 (all new tests, pre-refactor) | N/A — pure refactor task | ✅ 13/13 passed post-refactor | ➖ N/A (refactor task) | ✅ Extracted `openDirectoryHandle` (deduped open+fstat+isDirectory between acquire/alias-prove) and `childPath` (deduped anchored-path string building across 3 call sites) |

### Test Summary

- **Total tests written**: 16 new tests across both attempts (10 in attempt 1 + 6 in attempt 2; file now has 19 `test()` calls total: 3 pre-existing legacy tests + 16 new pinned-directory tests)
- **Total tests passing**: 19/19 (full `verify-private-local-diagnostics-artifact.test.mjs`), 2/2 (`private-local-diagnostics-verification-lib.test.mjs`, untouched)
- **Layers used**: Unit (19, all real `os.tmpdir()` fixtures + injected `fs`/`platform`/`onCheckpoint` seams, no mocking framework, no sleeps)
- **Approval tests** (refactoring): None — no refactoring of existing behavior in this unit; 1.15 refactored only newly-added Unit 1 code, verified by rerunning its own new tests plus the untouched legacy tests
- **Pure functions created**: `detectPinnedDirectoryCapability`, `sameStamp`, `classify`, `procFd`, `childPath`, `captureDirectoryStamp` are pure; the FD/IO-bearing primitives (`acquirePinnedDirectory`, `proveDirectoryAlias`, `readPinnedChild`, etc.) are necessarily side-effecting (real fd/file operations) but take injected `fs` as their only IO dependency

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` → 19/19 pass (post attempt-2 fixes) |
| Runtime harness command/scenario and exact result | N/A for this unit — design/tasks state the new primitives are not dispatch-reachable until Unit 2; no CLI/runtime path exercises them yet. The existing CLI-spawn regression test (`node scripts/verify-private-local-diagnostics-artifact.mjs ...`, embedded in the pre-existing "CLI explicitly reports..." test) continues to cover only the unchanged legacy path and stays green. |
| Rollback boundary | Revert `scripts/private-local-diagnostics-verification-lib.mjs` to before this unit's new exports (the new functions after the `verifyArtifact` function body) and drop the 16 new tests from `scripts/verify-private-local-diagnostics-artifact.test.mjs`; `verifyArtifact`/`parseVerificationArgs`/CLI wrapper/`package.json` are untouched across both attempts, so this is a clean, zero-production-behavior-change revert. |

## Deviations from Design (as of attempt 1 — see Correction Round for the fix)

Attempt 1 shipped with 5 verified deviations from `design.md`'s Child defense, Error mapping, and Acquire/prove rows, found by the parent's spot check against real temp directories (not caught by attempt 1's own test suite, since that suite never exercised these specific inputs). Reported truthfully:

1. Child basenames from `entries` were never validated against `design.md`'s Child defense rule ("validated basenames only (no separators/`..`)") before being interpolated into the `/proc/self/fd/<fd>/<basename>` anchored path — a basename like `"sub/c.json"` or `"../escape.json"` would read outside the held directory.
2. `readPinnedChild`'s single catch block funneled every failure (including its own explicitly-thrown static-safety errors) through `classify(error, failRace)`, which discarded the original error and re-threw as `V_RACE` — so a static, non-race unsafe child (hardlink, FIFO, directory entry, symlink, oversize) was misreported as a race instead of `design.md`'s Child defense/legacy `snapshot()` classes.
3. Same root cause as #2: a 0-byte child was accepted instead of rejected (legacy `snapshot()`'s `size < 1` rule was not ported to the pinned-child path).
4. `acquirePinnedDirectory` opened the raw caller-supplied path directly — it did not require an absolute path, did not reject a final symlink via `lstat`, and did not canonicalize via `realpathSync` before opening, as `design.md`'s Acquire/prove row requires ("Reject a final symlink; canonicalize the absolute input; open …").
5. Tasks 1.11–1.14's tests passed on first write without ever observing a genuine failure (RED), because the steps 1–4 pipeline built in 1.6/1.8/1.10 already generalized to cover those scenarios — this was recorded honestly in attempt 1's evidence table, but the parent flagged it as missing RED evidence per Strict TDD's hard gate, requiring after-the-fact characterization/mutation-check proof (see Correction Round item 5 below).

Deviations #1–#4 were real security/correctness gaps in the pinned-directory primitives (not merely test-coverage gaps); #5 was a TDD-process/evidence gap with no functional defect. All 5 are fixed in the Correction Round below; `verifyArtifact`/`parseVerificationArgs`/CLI wrapper/`package.json` were never affected by either attempt (all new code stays unreachable from production dispatch).

## Issues Found

None beyond the 5 deviations above, all resolved in the Correction Round.

## Correction Round (Attempt 2 — fixes for the 5 verified findings)

Constraints: same edit scope (`scripts/private-local-diagnostics-verification-lib.mjs`, `scripts/verify-private-local-diagnostics-artifact.test.mjs`, this file), Strict TDD (RED observed → GREEN), `verifyArtifact`/`parseVerificationArgs`/CLI wrapper/`package.json` stay byte-identical, new primitives stay unreachable from dispatch, total Unit 1 diff stays ≤400 changed lines.

### Finding 1 — Unvalidated child basenames

- **Fix**: `verifyPinnedDirectory` now calls the file's existing `name(entry.basename, "basename")` validator (already throws `V_MANIFEST: … is unsafe`, rejects separators/`..`/empty) on every entry as the very first statement, before `acquirePinnedDirectory` or any `fs` call.
- **RED**: new test `"rejects unsafe basenames (separators, .., empty) before any filesystem lookup"` — injects an `fs` seam that records every method call; asserted `V_MANIFEST: basename is unsafe` was thrown for `"sub/c.json"`, `"../escape.json"`, and `""`, and that the call-tracking array stayed empty. **Observed RED** (`not ok 14`) before the fix: the module still tried to open/lstat through the unsafe basename instead of rejecting up front.
- **GREEN**: after adding the `name()` loop, **observed GREEN** (`ok 14`).

### Finding 2 & 3 — Static unsafe/empty child mislabeled as `V_RACE`

- **Fix**: `readPinnedChild` now checks `before.isSymbolicLink()` → `fail("symlinks are forbidden")` (→ `V_MANIFEST: symlinks are forbidden`, matching legacy `snapshot()`), then `!before.isFile() || before.nlink !== 1n || before.size < 1n || before.size > limit` → `fail("unsafe file")` (→ `V_MANIFEST: unsafe file`). `V_RACE` is now reserved for the two genuine dynamic checks: the lstat→open/fstat `dev`/`ino` mismatch, and a byte-count/short-read mismatch during the step-1 read. The catch block was also fixed to stop reclassifying its own already-thrown `V_MANIFEST`/`V_RACE` errors through `classify(error, failRace)` (which had been silently converting them all to `V_RACE`) — it now re-throws any error whose message already starts with `V_` unchanged, and only routes genuine native `fs` errors through `classify`.
- **RED**: new test `"step-1 static child violations are classified as V_MANIFEST (legacy snapshot classes), never V_RACE"` — 6 cases: hardlink (`nlink=2`), FIFO (`mkfifo`), directory entry, symlink, oversize (5000 bytes vs 4096 limit), and empty (0 bytes). **Observed RED** (`not ok 15`) before the fix: all 6 cases threw `V_RACE: inspection bundle changed during verification` instead of the expected `V_MANIFEST` classes.
- **GREEN**: after the fix, **observed GREEN** (`ok 15`), all 6 cases correctly classified.

### Finding 4 — No input canonicalization in `acquirePinnedDirectory`

- **Fix**: `acquirePinnedDirectory` now requires `isAbsolute(path)`, rejects when `fs.lstatSync(path).isSymbolicLink()` (both → `V_DIRECTORY: artifact directory is unsafe`, no fs call at all for the relative-path case), then opens `fs.realpathSync(path)` (the canonical path) instead of the raw input. `proveDirectoryAlias` (step 3) is unchanged — `verifyPinnedDirectory` still passes it the original, uncanonicalized `path` argument.
- **RED**: 3 new tests, each isolating one behavior with a deterministic `fs` seam (not relying on incidental `ENOENT`/`ELOOP` side effects, which would have coincidentally passed against the unfixed code and hidden the real gap):
  - `"acquisition rejects a relative path without any filesystem lookup"` — call-tracking seam, asserts zero calls. **Observed RED** (`not ok 16`): the unfixed code called `openSync` on the raw relative path (only accidentally failing via `ENOENT` at cwd, not via an explicit check).
  - `"acquisition rejects a final symlink via lstat before ever attempting to open it"` — seam makes `lstatSync` report a symlink and makes `openSync` throw a synthetic `EMFILE`-coded trap error if ever reached. **Observed RED** (`not ok 17`): the unfixed code reached `openSync`, which threw the `EMFILE` trap; since `EMFILE` is a raw/unclassified errno it propagated unchanged instead of `V_DIRECTORY`, failing the assertion.
  - `"acquisition opens the realpathSync-canonicalized path rather than the raw input path"` — seam maps a raw temp dir to a *different* canonical temp dir via `realpathSync` and asserts the returned `pinned.dev`/`pinned.ino` match the canonical directory's real stat, not the raw one's. **Observed RED** (`not ok 18`): the unfixed code opened the raw path directly, so `pinned.dev`/`pinned.ino` matched the raw directory instead of the canonical one.
  - A 4th confirmatory test, `"an ancestor symlink in the caller path is accepted … and step 3 still re-opens the original, uncanonicalized caller path successfully"`, was added and passed without needing the fix (the kernel already follows non-final/ancestor symlinks transparently for both the canonical open and the step-3 alias reopen) — kept as regression coverage for the "step 3 keeps using the original caller path" requirement.
- **GREEN**: after the fix, **observed GREEN** for all 4 (`ok 16`–`ok 19`).

### Finding 5 — Missing RED evidence for tasks 1.11–1.14 (characterization + mutation-check evidence, not rewritten history)

Per the parent's instruction, attempt 1's honest record (these tests passed on first write because the pipeline already generalized to cover them) is preserved unchanged above — it is **not** rewritten as if original RED had occurred. Instead, this section adds after-the-fact mutation-check evidence: for each guard, the specific check was temporarily neutralized (`X` → `false && X`) in the source, the *exact same, unmodified* focused test was re-run in isolation via `node --test --test-name-pattern="<name>"`, the observed result was recorded, then the guard was restored and the file was confirmed byte-for-byte back to its fixed form (`grep -n "false &&"` returned no matches) before the final verification run. No mutation was left in the shipped code.

| Task | Test | Guard neutralized | Observed result with guard OFF | Restored + reconfirmed |
|---|---|---|---|---|
| 1.11 | `"a basename appearing between step 1 and step 2 is a race"` | presence-flip check alone (`classifyBasename(...) !== present`) | **Still passed** — the directory-stamp recheck (`sameStamp`) independently catches it, because adding a directory entry bumps the directory's own `mtime`/`ctime` on Linux. Disabling **both** the stamp check and the presence-flip check together produced the genuine failure: `AssertionError: Missing expected exception.` | ✅ both restored, `ok 10` reconfirmed |
| 1.11 | `"an alias renamed away, or renamed away and replaced by a new directory, between steps 2 and 3 is rejected as unsafe"` | alias `dev`/`ino` mismatch check in `proveDirectoryAlias` | **Failed as expected**: `AssertionError: The input did not match /V_DIRECTORY.../. Input: 'Error: V_RACE: ...'` — with the alias check disabled, the directory-stamp recheck at step 4 (ctime bump from the rename) still fires, but as the wrong class (`V_RACE` instead of `V_DIRECTORY`), proving the alias check is what supplies the class-precise, spec-required guard | ✅ restored, `ok 11` reconfirmed |
| 1.11/1.12 | `"a same-A child replacement between steps 3 and 4 is a race, while a mutation strictly before its step-1 read is legitimate input"` | child metadata comparison in `recheckPinnedChild` alone | **Still passed** — the directory-stamp recheck independently catches it (rename-over also bumps the enclosing directory's `ctime`). Disabling **both** the stamp check and the child-metadata check together produced the genuine failure: `AssertionError: Missing expected exception.` | ✅ both restored, `ok 12` reconfirmed |
| 1.13/1.14 | `"EMFILE, ENFILE, EIO, and ENOMEM stay unclassified…"` | `classify`'s `RAW_ERRNO` passthrough (`if (false && error && RAW_ERRNO.has(error.code)) throw error;`) | **Failed as expected**: `AssertionError: The validation function is expected to return "true". Received false / Caught error: Error: V_DIRECTORY: artifact directory is unsafe` — the raw `EMFILE` error got reclassified as `V_DIRECTORY` instead of propagating unchanged | ✅ restored, `ok 13` reconfirmed |

This is characterization-test + mutation-check evidence, not original RED — the production code for 1.11–1.14 was already correct (built generically during 1.6/1.8/1.10) and required **no change** in this correction round. The mutation checks additionally surfaced that the directory-stamp recheck provides redundant defense-in-depth for two of the four scenarios (a genuine, useful discovery about this design's overlapping guards, not a defect).

## Unit 2: Mode/Evidence Integration, Compatibility, Regressions (PR 2) — this apply batch

Base: working tree clean at `2aafc3026` (merged `fork/master`; PR #26/Unit 1 + both review-fix rounds already in the base, 27/27 focused tests green before this batch). Edit scope: only `scripts/private-local-diagnostics-verification-lib.mjs`, `scripts/verify-private-local-diagnostics-artifact.test.mjs`, and this change folder's `tasks.md`/`apply-progress.md`. No git operations performed (parent owns commit/push).

### Completed Tasks

- [x] 2.1 RED — evidence-context CLI grammar (missing/duplicate/unexpected/mismatched `--audience`/`--case-id`/`--incident-id` → `E_AUTH`) and canonical-pathname-presence activation tests, written against the still-legacy-only `verifyArtifact`
- [x] 2.2 GREEN — extended `parseVerificationArgs` to return `contextArgs` (tail beyond the frozen 4-arg grammar) and added `parseEvidenceContext` (Hefesto/Optimus grammar, `SAFE_ID`, `incidentId ≠ caseId`, all fail-closed as `E_AUTH`)
- [x] 2.3 RED — legacy-via-pinned-primitives test plus a dedicated mid-verification classification-change race test (authorization pair appearing or disappearing between step 1 and the anchored rechecks)
- [x] 2.4 GREEN — renamed the prior `verifyArtifact` body to private `verifyLegacyUnpinned` (byte-identical, used only by the non-Linux/no-procfs fallback); new `verifyPinnedArtifact` routes both legacy (no context) and evidence dispatch through Unit 1's `verifyPinnedDirectory`, entries always including the two optional authorization files so their presence/absence is classified once at step 1 and rechecked generically at steps 2/4 (no new race-detection code needed — Unit 1's existing presence-recheck loop already catches a mid-flight appearance/removal)
- [x] 2.5 RED — accepted-evidence test (Hefesto + Optimus, matched `caseId`/`incidentId`), a tamper-mutation test (cross-case mismatch, declarative storage locator tamper, cross-binding digest tamper — all `E_AUTH`), a time-policy test (future-issued and expired evidence — `E_AUTH`), and a capability-gate test (immediate `V_CAPABILITY` with any context on unsupported capability; `V_CAPABILITY` with no context but observed complete/partial evidence; exact legacy result with no context and reliably absent evidence)
- [x] 2.6 GREEN — added `readPinnedChild`'s `content` field (raw bytes, previously discarded after hashing) and a new `afterRead(children, fs)` hook on `verifyPinnedDirectory`, called once after step 1's read loop and before the `step1-complete` checkpoint (steps 1–4 ordering/checkpoint names themselves unmodified, exactly as 1.10 built them to allow); `buildPinnedResult` (the `afterRead` callback) parses/cross-binds receipt+verification+artifact (legacy-equivalent), then — only when the authorization pair is complete and CLI context was supplied — calls `parseAuthorizationEvidence`/`parseAuthorizationSidecar`/`crossBindAuthorization`/`validateAuthorizationPolicy` from the read-only `private-local-diagnostics-authorization-lib.mjs` against the pinned-read bytes; `storage.custodyRoot`/`storage.locator` are validated only inside that library's own `validateAuthorizationEvidence` (declarative string comparison), never filesystem-resolved by this file
- [x] 2.7 RED — CLI wrapper regression test (generic stderr line preserved for a rejected evidence-mode call, no error detail leakage); FIFO/symlink/hardlink/replacement/short-read/archive-non-execution cases are unchanged by construction (authorization files flow through the exact same `readPinnedChild`/`recheckPinnedChild`/`verifyChildContent` primitives Unit 1 already covers for every basename) and the 3 pre-existing CLI/library tests (benign+malicious, static-archive/receipt/symlink deviations, CLI spawn) continue to pass unmodified, now exercised through the pinned dispatch on real Linux
- [x] 2.8 GREEN — confirmed via `git diff --quiet HEAD -- scripts/verify-private-local-diagnostics-artifact.mjs package.json` (`unchanged`); the CLI wrapper still calls only `verifyArtifact(process.argv.slice(2))` and its generic catch-all is untouched
- [x] 2.9 Refactor & verify — extracted `requireChild(children, basename, label)` (find-or-fail-closed) to remove the repeated `if (!child) fail(...)` pattern across receipt/receipt-sidecar/verification/verification-sidecar/artifact lookups in `buildPinnedResult`; full focused suite reconfirmed green after the refactor

## Unit 1 Workload / PR Boundary (historical)

- Mode: chained PR slice (stacked-to-main)
- Current work unit: Unit 1 — Pinned Primitives, Capability, Races (PR 1)
- Boundary: starts from the legacy-only verifier (HEAD `907ba852190a283b04dc2ee75050aa5505393da4`); finishes with pinned directory/child/checkpoint primitives added and unit-tested (including the attempt-2 security/correctness fixes), `verifyArtifact`/`parseVerificationArgs` untouched, new primitives unreachable from CLI/production dispatch
- Estimated review budget impact: `git diff --stat -- scripts/` = 352 insertions(+), 3 deletions(-) → 355 changed lines (attempt 1 was 275; the correction round added 80 lines), still under the 400-line budget

## Unit 1 Verification (attempt 2, foreground, after the Correction Round) (historical)

1. `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` → **19/19 pass**
2. `node --test scripts/private-local-diagnostics-verification-lib.test.mjs` → **2/2 pass** (untouched, still green)
3. `git diff --stat -- scripts/` → **352 insertions(+), 3 deletions(-)** = 355 changed lines (≤400 budget)
4. `git diff --quiet HEAD -- scripts/verify-private-local-diagnostics-artifact.mjs package.json && echo unchanged` → **`unchanged`**

## Unit 1 Status (historical)

15/15 Unit 1 tasks complete, all 5 attempt-1 findings fixed and verified in attempt 2 (Strict TDD RED→GREEN for Findings 1–4; mutation-check characterization evidence for Finding 5). Superseded by Unit 2's completion below — see the end of this file for the current overall status.

## PR #26 review fixes (Greptile findings, separate bounded work unit `unit-1-review-fixes`)

Unit 1 was committed as `07084a46d` on `feat/private-diagnostics-pinned-directory-primitives` (21/21 green at that commit). This work unit fixed 3 verified findings from Greptile's PR #26 review, still within the Unit 1 primitives, under Strict TDD (RED observed → GREEN). No git operations were performed here — the parent owns commit/push. Edit scope: only `scripts/private-local-diagnostics-verification-lib.mjs` and `scripts/verify-private-local-diagnostics-artifact.test.mjs`.

### Finding 1 (P1) — hard-link race in `readPinnedChild`

- **Defect**: `nlink === 1n` was checked only on the pre-open `lstat`, and the baseline recorded for later rechecks was `opened.nlink` (whatever the post-open `fstat` reported) rather than a re-validated `1n` — a hard link created between the `lstat` and the `fstat`/read would raise the link count to 2 but be silently accepted as the new baseline.
- **Fix**: `readPinnedChild` now also requires `opened.nlink === 1n` after open and `after.nlink === 1n` after the read (either violation → `V_RACE`), and always records the child's baseline `nlink` as the literal `1n` (not whatever value `fstat` happened to report).
- **RED**: new test `"a hard link appearing during a child open or read is a race, never accepted as the recorded baseline"` — an injected `fs` seam whose child-fd `fstatSync` reports `nlink: 2n` on the *first* child-fd call (the post-open check) in one pass, and on the *second* child-fd call (the post-read check) in another pass (directory-fd `fstatSync` calls are left untouched by filtering on `isFile()`). **Observed RED** (`not ok 20`, `AssertionError: Missing expected exception.`) before the fix — both cases silently succeeded.
- **GREEN**: after the fix, **observed GREEN** (`ok 22` in the final numbering) for both cases.

### Finding 2 (P2) — directory FD leak in `openDirectoryHandle`

- **Defect**: `openDirectoryHandle` opened the FD and then called `fstatSync`/`isDirectory()` with no `try`/`catch` of its own; if that call threw (or found a non-directory), the exception propagated before the function returned `{ fd, stat }`, so the caller's own `fd` variable was never assigned and the just-opened descriptor was never closed by anyone — a leak on every such failure in both `acquirePinnedDirectory` and `proveDirectoryAlias`.
- **Fix**: `openDirectoryHandle` now wraps the `fstatSync`/`isDirectory` check in its own `try`/`catch`, closing the FD (via the new best-effort `closeQuietly` helper) before rethrowing the original error unchanged — so the caller never has to know about this internal FD, and no error is added or reclassified.
- **RED**: new test `"openDirectoryHandle closes its FD when fstat fails or reports a non-directory, for both acquire and the alias check, without reclassifying the error"` — two cases (`fstatSync` throwing a synthetic `EIO`, and `fstatSync` reporting `isDirectory: () => false`), each run through both `acquirePinnedDirectory` and `proveDirectoryAlias`, asserting `closeSync` was called with exactly the FD that `openSync` had just returned, and that the thrown error is unchanged (`EIO` stays the identical raw error object; non-directory is `V_DIRECTORY`). **Observed RED** (`not ok 21`, `Expected values to be strictly deep-equal: + [] - [21]` — zero close calls recorded) before the fix.
- **GREEN**: after the fix, **observed GREEN** (`ok 23`) for all 4 sub-cases (2 fault types × 2 call sites).

### Finding 3 (P2) — cleanup could mask the primary error

- **Defect**: `verifyPinnedDirectory`'s `finally` block looped `fs.closeSync(child.fd)` then `fs.closeSync(pinned.fd)` with no `try`/`catch`; if any one `closeSync` threw, that close error **replaced** whatever the `try` block was doing (a real result or a propagating `V_RACE`/`V_DIRECTORY`/etc.), per plain-`finally` semantics, and the loop **stopped**, so any FD after the failing one was never even attempted. The same masking risk existed in `readPinnedChild`'s catch-block close and in `acquirePinnedDirectory`/`proveDirectoryAlias`'s cleanup.
- **Fix**: added a shared `closeQuietly(fs, fd)` (best-effort, swallows close errors, used wherever a *primary* error is already being propagated: `acquirePinnedDirectory`'s catch, `proveDirectoryAlias`'s finally, `readPinnedChild`'s catch, `openDirectoryHandle`'s internal catch) and a `closeAll(fs, fds)` (attempts every FD regardless of individual failures, returning the *first* close error without throwing). `verifyPinnedDirectory` was restructured to run its body in a `try { … } catch (error) { primaryError = error; }` that assigns to `result`/`primaryError` instead of `return`ing or letting `finally` run bare `closeSync` calls; after the try/catch, it calls `closeAll` unconditionally over every child FD plus the directory FD, then: if a primary error was captured, throws that (a close failure is silently ignored in this case, matching "never throw from cleanup when a primary error is propagating"); otherwise, if `closeAll` reported a close error, throws that (matching "if the verification succeeded but a close fails, surface that close error only after all FDs were attempted"); otherwise returns the result.
- **RED**: new test `"a close failure during cleanup never masks a propagating V_RACE, and every FD still receives a close attempt"` — two children plus one basename injected mid-flight (reusing the existing race-injection technique) to force a genuine `V_RACE`, with a `closeSync` seam that throws on its *first* invocation (recording every attempted `fd` regardless). **Observed RED** (`not ok 22`) before the fix, in two ways: the thrown error was `Error: close failed` instead of matching `/V_RACE.../`, and (separately confirmed via the stack trace) the close loop stopped after the first failing FD instead of attempting the other two.
- **GREEN**: after the fix, **observed GREEN** (`ok 24`) — the thrown error is the original `V_RACE`, and all 3 FDs (2 children + directory) show up in the attempted-close list even though the first attempt failed.
- **NOT a defect (left unchanged, per parent instruction)**: raw `EIO`/`ENOMEM`-style errors from `fstatSync` on already-held descriptors (e.g. inside `captureDirectoryStamp`/`recheckPinnedChild`, which have no `try`/`catch` of their own) continue to propagate unclassified by design — this matches `design.md`'s Error mapping row ("Any other errno … propagates unclassified as today … and is never relabeled `V_DIRECTORY` or `V_RACE`") and the existing test `"EMFILE, ENFILE, EIO, and ENOMEM stay unclassified…"` already covers this; no change was made here.

### Verification (this work unit, foreground)

1. `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs scripts/private-local-diagnostics-verification-lib.test.mjs` → **24/24 pass** (21 pre-existing + 3 new; `private-local-diagnostics-verification-lib.test.mjs`'s 2 tests are included and untouched)
2. `git diff --stat -- scripts/` (vs commit `07084a46d`) → **75 insertions(+), 13 deletions(-)** = 88 changed lines (≤120 budget)
3. `git diff --quiet HEAD -- scripts/verify-private-local-diagnostics-artifact.mjs package.json && echo unchanged` → **`unchanged`**

### Files changed (this work unit)

| File | What changed |
|---|---|
| `scripts/private-local-diagnostics-verification-lib.mjs` | Added `closeQuietly`/`closeAll` helpers; `openDirectoryHandle` now closes its own FD on failure; `acquirePinnedDirectory`/`proveDirectoryAlias`/`readPinnedChild` route their cleanup through `closeQuietly`; `readPinnedChild` adds the two `nlink === 1n` post-open/post-read checks and records a literal `1n` baseline; `verifyPinnedDirectory` restructured so a close failure never replaces a propagating primary error, and only surfaces on the success path. `verifyArtifact`/`parseVerificationArgs` untouched (diff confined to lines after them); no new exports; no dispatch wiring. |
| `scripts/verify-private-local-diagnostics-artifact.test.mjs` | 3 new tests (hard-link race, directory-FD-leak-on-fstat-failure, cleanup-never-masks-primary-error); no existing test modified or removed. |

### Status (this work unit)

3/3 Greptile-verified findings fixed and verified; 24/24 focused tests green; 88/120 line budget used. No git operations performed. Ready for the parent to review/commit/push.

## PR #26 errno classification (Greptile, last remaining P2, separate bounded work unit `unit-1-errno-classification`)

Unit 1 (plus the prior review-fix round) was committed as `163e5e1a9` on `feat/private-diagnostics-pinned-directory-primitives` (24/24 green at that commit). This work unit fixed the last verified Greptile finding: two different error contracts existed in the same file — `classify()` allowlisted `EMFILE`/`ENFILE`/`EIO`/`ENOMEM` as "stays raw" and mapped **everything else** (including e.g. `EPERM`/`EROFS`) to `V_RACE`/`V_DIRECTORY`, while `captureDirectoryStamp()`/`recheckPinnedChild()`'s held-descriptor `fstatSync(child.fd)` calls were never wrapped in `classify()` at all, so any error there always stayed raw. Same failure class, two outcomes depending only on which line happened to touch it. `design.md`'s Error mapping row is the authority and only names four errnos as mapped: alias `ENOENT`/`ELOOP`/`ENOTDIR`/`EACCES` → `V_DIRECTORY` (step 3); the same four, for an entry recorded present, → `V_RACE` (steps 2/4); every other errno propagates unclassified. No git operations performed (parent owns commit/push); max 80 changed lines.

### Fix

Inverted `classify()` from a deny-list-of-raw-errnos to an allow-list-of-mapped-errnos, exactly the four `design.md` names:

```js
const MAPPED_ERRNO = new Set(["ENOENT", "ENOTDIR", "ELOOP", "EACCES"]);
const classify = (error, failer) => { if (error && MAPPED_ERRNO.has(error.code)) failer(); else throw error; };
```

`captureDirectoryStamp()`/`recheckPinnedChild()`'s bare `fstatSync(pinned.fd | child.fd, …)` calls were **not** touched — per the parent's explicit instruction, a held-descriptor `fstat` cannot produce a path-resolution errno (`ENOENT`/`ENOTDIR`/`ELOOP`/`EACCES`), so leaving them unwrapped is now consistent by construction with the same four-errno contract everywhere else in the file; wrapping them in `classify()` would have been a no-op that only added risk of an observable-behavior slip, so it was deliberately skipped. `RAW_ERRNO` was replaced (not kept alongside), since nothing outside this module-private constant referenced it by name.

### Per-case RED/GREEN evidence

| Case | Test | Result against old `classify()` (pre-fix) | Result after the fix |
|---|---|---|---|
| `EACCES` on a step-2/4 lookup for an entry recorded present | `"an EACCES on a step-2/4 lookup for an entry recorded present is a race"` (new) | **Already passed** — old deny-list also happened to classify `EACCES` (anything not in `{EMFILE,ENFILE,EIO,ENOMEM}` was mapped), so this is confirmatory, not a genuine RED→GREEN for this case | `ok` — `V_RACE`, now via the correct narrow rule |
| `ENOENT`/`ENOTDIR`/`ELOOP` on the alias reopen (step 3) | `ENOENT` already covered by the pre-existing `"an alias renamed away…"` test; new test `"ENOTDIR and ELOOP on the alias reopen (step 3) are V_DIRECTORY"` isolates step 3 specifically (a call-counted `openSync` seam lets the first open, at acquire, succeed and only faults the second open, at step 3) | **Already passed** — same reason as above, confirmatory | `ok` — `V_DIRECTORY` |
| Non-allowlisted errno (`EPERM`/`EROFS`) on a lookup | `"a non-allowlisted errno (EPERM/EROFS) on a lookup propagates unchanged, and EBADF on a held-descriptor fstat propagates unchanged"` (new) | **Genuine RED** (`not ok 25`): `AssertionError: The validation function is expected to return "true". Received false / Caught error: Error: V_RACE: inspection bundle changed during verification` — the raw `EPERM` was wrongly turned into `V_RACE` under the old deny-list | **GREEN** (`ok 27`) — the identical raw `EPERM`/`EROFS` error object is rethrown unchanged |
| `EBADF` on a held-descriptor `fstat` (`captureDirectoryStamp`) | second half of the same test above | Never reached in the pre-fix run (the test threw on its first `EPERM` assertion before getting here); by inspection this call site was never wrapped in `classify()` before or after this fix, so it was already correct — confirmatory once the first half was fixed | `ok` — unchanged raw `EBADF` propagates |
| `EMFILE`/`EIO` still raw | pre-existing `"EMFILE, ENFILE, EIO, and ENOMEM stay unclassified…"` test | passed (unaffected — these 4 codes were never in the old deny-list's complement in a way this test exercises, and are not in the new allow-list either) | still passes, unmodified |

### Changed test expectations

**None.** Every pre-existing test in `verify-private-local-diagnostics-artifact.test.mjs` continued to pass unmodified after the inversion (confirmed by grepping the file for injected error `code`s before writing any fix: only `EMFILE`/`ENFILE`/`EIO`/`ENOMEM` were ever used as explicit codes, and no test relied on `classify()` turning a *code-less* thrown error into a classified one — every other test that expects `V_RACE`/`V_DIRECTORY` does so via an explicit comparison check (directory stamp, presence flip, `dev`/`ino`, `nlink`) rather than by injecting an arbitrary errno through `classify()`). 4 new tests were added; 0 existing tests were changed or removed.

### Verification (this work unit, foreground)

1. `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs scripts/private-local-diagnostics-verification-lib.test.mjs` → **27/27 pass** (23 pre-existing + 4 new; `private-local-diagnostics-verification-lib.test.mjs`'s 2 tests included, untouched)
2. `git diff --stat -- scripts/` (vs commit `163e5e1a9`) → **42 insertions(+), 2 deletions(-)** = 44 changed lines (≤80 budget)
3. `git diff --quiet HEAD -- scripts/verify-private-local-diagnostics-artifact.mjs package.json && echo unchanged` → **`unchanged`**

### Files changed (this work unit)

| File | What changed |
|---|---|
| `scripts/private-local-diagnostics-verification-lib.mjs` | `RAW_ERRNO` (deny-list) replaced by `MAPPED_ERRNO` (allow-list of exactly `ENOENT`/`ENOTDIR`/`ELOOP`/`EACCES`); `classify()`'s branch inverted to match. 2-line diff, nothing else touched — `captureDirectoryStamp`/`recheckPinnedChild`'s bare `fstatSync` calls deliberately left as-is. `verifyArtifact`/`parseVerificationArgs` untouched. |
| `scripts/verify-private-local-diagnostics-artifact.test.mjs` | 4 new tests (`EACCES` on step-2/4 lookup, `ENOTDIR`/`ELOOP` on step-3 alias reopen, non-allowlisted `EPERM`/`EROFS` + `EBADF` propagate unchanged); no existing test modified or removed. |

### Status (this work unit)

Last remaining Greptile PR #26 finding fixed and verified; 27/27 focused tests green; 44/80 line budget used; 0 existing test expectations changed. No git operations performed. Ready for the parent to review/commit/push.

## Extra carried-over coverage task (JD-DESIGN-008 `recheckPinnedChild` isolation gap, done first in this apply batch)

Unit 1 had no test that isolates `recheckPinnedChild`'s own child-binding comparison from the redundant directory-stamp recheck (on real Linux a rename-over also bumps the directory `ctime`, so the stamp check alone can mask a missing/broken child check). Added one test using an injected `fs` seam that memoizes `fstatSync` results per fd (freezing the directory-fd stamp and, incidentally, the retained child fd's own stat — both irrelevant to the guard under test) while the *anchored* `lstatSync` on the child's live path stays real, so a rename-over between steps 3 and 4 still produces a genuinely different anchored `dev`/`ino` for `recheckPinnedChild` to catch.

- **Test**: `"recheckPinnedChild's own child binding catches a same-A rename-replacement between steps 3 and 4 even when the directory stamp is kept frozen through the fs seam"` in `scripts/verify-private-local-diagnostics-artifact.test.mjs`.
- **Observed on first write**: **passed** (not genuine RED) — the production code for `recheckPinnedChild` was already correct (built generically in Unit 1's 1.6/1.8/1.10), so no implementation change was needed or made. Reported honestly rather than claimed as RED, per the parent's instruction.
- **Mutation check (proves isolation)**: temporarily changed `recheckPinnedChild`'s comparison loop from `if (current.dev !== child.dev || ...) failRace();` to `if (false && (...)) failRace();`, reran the exact same unmodified test in isolation (`node --test --test-name-pattern="recheckPinnedChild's own child binding"`) with the directory stamp still frozen by the seam — **observed failure**: `AssertionError: Missing expected exception.` This proves the test's V_RACE assertion depends specifically on `recheckPinnedChild`'s own check, not on the redundant directory-stamp mechanism (which is neutralized-irrelevant here since it's frozen by the seam either way).
- **Restored**: guard reverted to its original form; `grep -n "false &&" scripts/private-local-diagnostics-verification-lib.mjs` returned no matches before any further work; full focused suite reconfirmed green (28/28 at that point).

## Unit 2 TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Extra (JD-DESIGN-008) | `verify-private-local-diagnostics-artifact.test.mjs` | Unit | ✅ 27/27 (baseline) | ➖ Passed on first write (see honest note above); proved via mutation check instead | ✅ 28/28 | ➖ N/A (isolation/characterization test, single scenario) | ➖ None needed |
| 2.1/2.2 | same | Unit | ✅ 28/28 (carried) | ✅ Written — `E_AUTH` assertions failed against unmodified code with `V_MANIFEST: expected --artifact-dir...` (wrong error class, confirmed genuine RED) | ✅ Passed after extending `parseVerificationArgs`/`parseEvidenceContext` | ✅ 7 grammar sub-cases (hefesto+incident-id, optimus missing incident-id, optimus incident=case, missing audience, duplicate case-id, unexpected flag, unsupported audience) + pathname-activation/partial-pair sub-cases | ✅ Clean |
| 2.3/2.4 | same | Unit | ✅ carried | ✅ Written — same wrong-error-class RED against unmodified code | ✅ Passed after adding `verifyPinnedArtifact`/`buildPinnedResult`/`verifyLegacyUnpinned` dispatch | ✅ 2 sub-cases (pair appearing after classification, pair vanishing after classification) — both caught by Unit 1's existing generic presence-recheck with zero new race-detection code | ✅ Clean |
| 2.5/2.6 | same | Unit | ✅ carried | ✅ Written — RED against unmodified code (no evidence wiring existed at all) | ✅ Passed after wiring `parseAuthorizationEvidence`/`parseAuthorizationSidecar`/`crossBindAuthorization`/`validateAuthorizationPolicy` in `buildPinnedResult`'s `afterRead` callback | ✅ Hefesto+Optimus acceptance (2 cases), cross-case mismatch / storage tamper / cross-bind digest tamper (3 cases), future-issued/expired time policy (2 cases), capability-gate immediate/observed/legacy (4 cases) — 11 triangulation cases total; **1 real bug found and fixed mid-GREEN**: a partial authorization pair (exactly one of manifest/sidecar present) was incorrectly falling through to the legacy `return base` path instead of failing `E_AUTH`, caught by the "partial pair" sub-case of test 28, fixed by counting `pairPresent` (0/1/2) instead of a boolean `pairComplete` | ✅ Clean |
| 2.7/2.8 | same | Unit | ✅ carried | ➖ Confirmatory (not RED) — the CLI wrapper's generic catch-all already covered any rejection reason before this batch; the new evidence-mode test only confirms the *existing* contract still holds after the dispatch rewrite | ✅ Passed | ➖ Single scenario (evidence-mode E_AUTH rejection); FIFO/symlink/hardlink/short-read/archive-non-execution regression coverage is inherited for free from Unit 1's existing 12+ tests since authorization files flow through the identical `readPinnedChild` primitive | ➖ None needed |
| 2.9 | same | Unit | ✅ 34/34 (all new tests, pre-refactor) | N/A — pure refactor task | ✅ 34/34 passed post-refactor | ➖ N/A (refactor task) | ✅ Extracted `requireChild(children, basename, label)` (find-or-fail-closed), removing 5 repeated `if (!child) fail(...)` blocks in `buildPinnedResult` |

### Unit 2 Test Summary

- **Total tests written**: 8 new tests for Unit 2 (tasks 2.1–2.9) plus 1 for the extra carried-over task = 9 new tests; file now has 34 `test()` calls total (26 pre-existing Unit-1-and-earlier tests + 8 new Unit 2 tests; the extra task's test is counted among the 26 since it was added first and is Unit-1-scoped)
- **Total tests passing**: 34/34 (`verify-private-local-diagnostics-artifact.test.mjs`), 2/2 (`private-local-diagnostics-verification-lib.test.mjs`, untouched) = 36/36 combined
- **Layers used**: Unit (all real `os.tmpdir()` fixtures + injected `fs`/`platform`/`onCheckpoint`/`clock` seams, no mocking framework, no sleeps; evidence fixtures built via a new `authFixture`/`hefesto`/`optimus` test helper reusing the production `formatAuthorizationSidecar`/`CUSTODY_ROOT` from the read-only authorization library)
- **Approval tests** (refactoring): None — 2.9 refactored only newly-added Unit 2 code, verified by rerunning the full focused suite (all 36 tests, including every pre-existing one)
- **Pure functions created**: `deriveArtifactId`, `findChild`, `requireChild`, `parseEvidenceContext`, `safeId` are pure; `buildPinnedResult`/`verifyPinnedArtifact`/`probeEvidencePresence`/`verifyUnsupportedArtifact` are necessarily side-effecting (filesystem/clock) but take injected `fs`/`platform`/`clock` as their only IO dependencies, consistent with Unit 1's pattern

## Unit 2 Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs scripts/private-local-diagnostics-verification-lib.test.mjs` → **36/36 pass** |
| Runtime harness command/scenario and exact result | `node scripts/verify-private-local-diagnostics-artifact.mjs --artifact-dir <dir> --receipt <name> [--audience hefesto\|optimus --case-id ID [--incident-id ID]]` — exercised directly by the CLI-spawn regression tests (`execFileSync` against the unmodified wrapper): the pre-existing "CLI explicitly reports..." test (legacy path, now through pinned dispatch) and the new "the CLI wrapper still reports only the generic failure line..." test (evidence-mode rejection path), both green |
| Rollback boundary | Revert `scripts/private-local-diagnostics-verification-lib.mjs` to its Unit-1-plus-review-fixes state (drop the `RECEIPT_SUFFIX`/`deriveArtifactId`/`findChild`/`requireChild`/`buildPinnedResult`/`verifyPinnedArtifact`/`probeEvidencePresence`/`verifyUnsupportedArtifact`/new `verifyArtifact` block, the `failAuth`/`CONTEXT_FLAGS`/`SAFE_ID`/`safeId`/`parseEvidenceContext` block, the `afterRead` hook line in `verifyPinnedDirectory`, the `content` field in `readPinnedChild`'s return, and the authorization-lib import; restore `parseVerificationArgs` to its 4-arg-only form; rename `verifyLegacyUnpinned` back to exported `verifyArtifact`) and drop the 9 new tests (8 Unit 2 + 1 extra task) from the test file; the CLI wrapper and `package.json` are untouched, so this is a clean, isolated revert |

## Unit 2 Workload / PR Boundary

- Mode: chained PR slice (stacked-to-main), PR boundary = Unit 2 (PR 2)
- Current work unit: Unit 2 — Mode/Evidence Integration, Compatibility, Regressions (PR 2)
- Boundary: starts from Unit 1 fully merged (`2aafc3026`, working tree clean, 27/27 focused tests green); finishes with legacy routed through Unit 1's pinned primitives, evidence-mode dispatch (Hefesto/Optimus grammar, cross-bind, one-clock policy, declarative storage) wired end to end and never exposed unpinned, and the CLI wrapper/`package.json` byte-identical — completes this change's P2 scope
- Estimated review budget impact: `git diff --stat -- scripts/` = 237 insertions(+), 5 deletions(-) = 242 changed lines (forecast was ≈210–270), well under the 400-line budget

## Unit 2 Verification (this apply batch, foreground)

1. `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` → **34/34 pass**
2. `node --test scripts/private-local-diagnostics-verification-lib.test.mjs` → **2/2 pass** (untouched, still green)
3. `git diff --stat -- scripts/` (vs `2aafc3026`) → **237 insertions(+), 5 deletions(-)** = 242 changed lines (≤400 budget)
4. `git diff --quiet HEAD -- scripts/verify-private-local-diagnostics-artifact.mjs package.json && echo unchanged` → **`unchanged`**

## Overall Status (current, supersedes all "Status" sections above)

Unit 1 (15/15 tasks, including both Greptile PR #26 review-fix rounds) and Unit 2 (9/9 tasks, tasks 2.1–2.9) are both complete, plus the extra carried-over JD-DESIGN-008 coverage task. This change's entire P2 scope (`pin-private-diagnostics-directory-linux`) is now implemented: 36/36 focused tests green, CLI wrapper and `package.json` byte-identical to the base, no git operations performed by this agent. Ready for `sdd-verify`.

## PR #27 follow-up: evidence-mode clock seam contract test (Greptile response, test-only, separate bounded work unit `unit-2-clock-contract-test`)

Unit 2 was committed as `4513ea2c5` on `feat/private-diagnostics-pinned-evidence-dispatch` (36/36 green at that commit). Greptile claimed the `clock` seam is documented as `() => number` and rejected numbers wrongly; the parent checked and found no document states that type (`design.md:53` writes `clock?` with no type; the parent change's design mentions `Date.now()` only as a rejected alternative). The real gap was that no test pinned which clock representations the seam accepts. Test-only work unit: no production code was changed, no git operations were performed (parent owns commit/push). Edit scope: only `scripts/verify-private-local-diagnostics-artifact.test.mjs`.

- **Test added**: `"evidence-mode clock seam accepts a UTC RFC3339 string or its equivalent bigint instant identically, rejects a bare number, and the default clock still works"` — reuses the existing `fixture`/`hefesto` helpers. Assertions: (1) an injected `clock: () => "2026-06-01T00:00:00Z"` (inside the grant's validity interval) is accepted and the result's `caseId` is `"CASE1"`; (2) an injected `clock` returning the equivalent `bigint` instant (`BigInt(Date.parse(iso)) * 1000000n`) is accepted and `assert.deepEqual`s to the exact same result as (1), proving both supported representations agree; (3) an injected `clock: () => Date.now()` (a bare `number`) is rejected with `/E_AUTH: verificationTime must be UTC RFC3339/`; (4) the default clock (no `clock` injected) still works for the same fixture.
- **Observed on first write**: **passed** (characterization test, not genuine RED) — `validateAuthorizationPolicy`'s existing `timestamp()` helper in the read-only `private-local-diagnostics-authorization-lib.mjs` already dispatches `bigint` directly and RFC3339 strings via regex parsing, and already rejects any non-bigint, non-string value (including `number`) via `typeof value !== "string"` before ever reaching the interval comparison — this was already correctly wired in Unit 2's `buildPinnedResult` (`validateAuthorizationPolicy(authorization, context, (dependencies.clock ?? (() => new Date().toISOString()))())`), so no implementation change was needed or made. Reported honestly per the parent's instruction rather than claimed as RED.
- **Mutation check (proves the test is not vacuous)**: temporarily changed the one clock-selection line in `scripts/private-local-diagnostics-verification-lib.mjs` from `(dependencies.clock ?? (() => new Date().toISOString()))()` to `(false && dependencies.clock ? dependencies.clock : (() => new Date().toISOString()))()` — i.e. forced the default (real-time) clock path unconditionally, simulating "the clock seam is silently ignored." Reran the exact same unmodified test in isolation (`node --test --test-name-pattern="evidence-mode clock seam"`). **Observed failure**: `AssertionError: Missing expected exception` on the `assert.rejects(... clock: () => Date.now() ...)` assertion — because with the seam ignored, the injected `Date.now()` clock never reaches `validateAuthorizationPolicy`; the default ISO-string clock is used instead, which is also within the grant interval (today, 2026-09-16, falls inside the fixture's `2026-01-01`–`2099-01-01` window), so the call unexpectedly succeeds instead of rejecting. This confirms the "rejects a bare number" assertion is the one load-bearing check that would catch a "clock seam ignored" regression (the string/bigint-acceptance assertions alone would not, since the real default clock also falls inside the same wide interval). Restored the line to its original form; `grep -n "false &&" scripts/private-local-diagnostics-verification-lib.mjs` returned no matches, and `git diff --stat -- scripts/private-local-diagnostics-verification-lib.mjs` showed zero changes before the final verification run.

### Verification (this work unit, foreground)

1. `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` → **35/35 pass**
2. `node --test scripts/private-local-diagnostics-verification-lib.test.mjs` → **2/2 pass** (untouched, still green)
3. `git diff --stat -- scripts/` (vs commit `4513ea2c5`) → **17 insertions(+)**, all in `verify-private-local-diagnostics-artifact.test.mjs`; `private-local-diagnostics-verification-lib.mjs` shows **zero changes** (≤60-line budget)

### Status (this work unit)

Clock-seam contract pinned with one characterization test plus mutation-check evidence; 35/35 + 2/2 = 37/37 focused tests green; 17/60 line budget used; zero production code changes. No git operations performed. Ready for the parent to review/commit/push.
