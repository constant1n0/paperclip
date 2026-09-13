# Apply Progress: Authorize Private Diagnostics Artifact

## Cumulative State

- P0a and P0b are merged in the declared base `fork/master@c5acc8cb24dabaa7ce4cd8512ed667a76c35cb2b`.
- P1 recovery generation 4, ordinal 4 applied the owner-authorized P1R-GATE-001/002 and P1R-JD-001/002 contract fixes in this clean worktree. It closed `passed` at runtime revision `sha256:95f4a2fe615a243a58f0cc196fea75240b2696605c1d37b28e2ee627b5c15b38`, with 82 native remediation lines and evidence `sha256:e7b7764944b3bd49ecd057ef6d5e3daf004d98104a001ddab373d8b3d72b8a49`. Generation 1 and generation 2 sources/evidence are superseded and quarantined; they are not implementation input or claimed as evidence here.
- P1 source is committed as `884a4d03ae421d95bf2378a08ce48379316d8d68`. This separate clean release worktree carries the recovery record plus the generation-5 clarification and generation-6 Greptile remediation.
- P2 and P3 remain blocked and untouched.
- Generation 5, ordinal 5 closed `passed` at runtime revision `sha256:b4ef0d935b4bea9de4864a24d596130d0fc9abc4dd5f783840e1af3ad428d989`, with 35 native changed lines and evidence `sha256:4b0f9556fce103e5934660d1428222b4d1b1454efc2a6484324fc6f400f3ecf9`. The owner-authorized test-only clarification made the existing Optimus fixture and invalid-context loop structurally explicit; focused re-review verified R2-001.

## P1 Evidence

- RED: `node --test scripts/private-local-diagnostics-authorization-lib.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before the module existed.
- GREEN: authorization contract tests passed 5/5; artifact receipt v1 tests passed 8/8; five-file producer tests passed 6/6; `node --check` and `git diff --check` passed.
- Both scoped judges verified P1R-GATE-001/002 and P1R-JD-001/002 with `JUDGMENT: APPROVED`; the fresh automatic gate passed. `private-local-diagnostics-artifact-lib.mjs` remains unmodified.

## Delivery Boundary

The complete stacked-to-main P1 candidate accounts for 302 added/deleted lines against the declared base, below the 350-line ceiling. PR #24 is open from the clean release branch; at generation-6 closure the remediation had not been committed, pushed, retriggered, or merged, and no release publication, verifier/CLI/manual/P2/P3 edit, custody resolution, signer, secret access, or `origin` write had occurred.

Generation 5 remained within its 80-line cap and preserved the P1-only boundary; no artifact/producer rerun was required because production code was untouched.

## Generation 6 Complete

- Native attempt closed `passed`: generation 6, ordinal 6, work unit `p1-greptile-rfc3339-early-years`.
- Runtime revision: `sha256:ce28191e7fe37db9ad6c2d54dbe6dde6bc68d95076cc10284ce6c3ea8a99923a`; evidence: `sha256:417f86a25a2b868b037c42b896bbe3943a9bbc1c83e73e8a9626833135801b0b`.
- Free Starter constraint: no commit, push, external Greptile retrigger, or merge occurred.
- RED: the focused authorization suite failed on canonical year `0001` evidence before production code changed.
- GREEN: year `0001`, the `0099`→`0100` policy interval, and impossible `0001-02-29` behavior passed after the no-remap construction.
- Current full P1 base-to-candidate accounting after all generation-10 ledger additions: 304 additions and 3 deletions (307 changed lines) against the declared P1 base; generation 6 itself was 31 additions and 1 deletion (32 changed lines).
- Both blind scoped judges returned `JUDGMENT: APPROVED`; Greptile later reached 5/5 at `f14867c42`, with count-only R3-003 pending external rereview.

## P2 Generation 12 — Static Verifier

- P2 tasks 3.1–3.3 are complete in this stacked-to-main slice; P3 remains untouched.
- RED: `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` failed before production wiring because partial evidence was accepted in legacy mode.
- GREEN: focused verifier tests passed 4/4; authorization-contract tests passed 5/5; syntax and whitespace checks passed.
- Legacy uses its unchanged five-file `snapshot()` path and result. Evidence mode requires the canonical pair plus exact context, uses hardened rechecks, captures one clock, returns `authorizationEvidence: "unsigned"`, and never executes archive content.
- Candidate accounting against `907ba8521`: 96 additions and 7 deletions (103 changed lines), within the P2 395-line ceiling. Rollback: revert this P2 slice only.

## P2 Judgment Day Fix Round 1

- Fixed `P2-JD-001`: canonical authorization manifest/sidecar discovery now uses no-follow pathname entry probes, with only `ENOENT` treated as absent; a post-probe recheck prevents introduced or replaced evidence paths from silently selecting legacy verification.
- RED: the focused verifier test failed on dangling canonical entries and the deterministic discovery probe before the implementation change. GREEN: the focused verifier, authorization-contract, and receipt-v1 regression tests pass with base-derived legacy-result, dangling-entry, replacement, and one-clock-call coverage. Both scoped judges verified `P2-JD-001`; the candidate is 186 additions and 6 deletions (192 changed lines) against `907ba8521`, and P2 tasks remain complete.

## P2 Generation 13 — Ordinal 14 Clean-Room Recovery

- Reconstructed from sealed trusted tree `4432a23831ade0d124bd3f35928a92f5ae1329f5`; the contaminated worktree was quarantined and not reused. Ordinal 13 is failed/invalidated; ordinal 14 started from the sealed tree at revision `sha256:3a16f5a1fa9190fddda2bbd510b9e445c8053535017283a3676ab066d847dae8`.
- RED: `node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` failed with `SyntaxError: ... does not provide an export named 'hardenedSnapshot'` before production wiring.
- GREEN: the focused verifier test passes after adding an evidence-only injected-filesystem seam with real Node fs defaults and deterministic replacement, read/inspection mutation, final-path recheck, hardlink, and non-regular-file proofs. Both scoped judges verified `P2-GATE-002`; the clean-room correction is 51 additions and 8 deletions (59 lines), the full P2 candidate is 230 additions and 7 deletions (237 lines), and P3 remains unchecked.

## P2 R1-P2-001 Corrective Note

- Fixed only `R1-P2-001`: evidence-mode `openSync()` now includes `O_NONBLOCK` while retaining `O_NOFOLLOW`; the post-open descriptor also must remain a single-link regular file with the pre-open device/inode.
- RED: the exact verifier test failed before this change because the injected FIFO replacement was not rejected until later inspection. GREEN: it now asserts the nonblocking/no-follow flags and immediate FIFO rejection; verifier 7/7, authorization-contract 5/5, receipt-v1 8/8, both Node checks, and `git diff --check` pass. Scoped risk re-review verified `R1-P2-001` with `PRE-COMMIT: PASS`; after persisting the empty pre-push ledger, the ordinal-14 correction is 83 additions and 9 deletions (92 lines), and the full P2 candidate is 261 additions and 7 deletions (268 lines).
