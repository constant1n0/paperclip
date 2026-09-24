# Review Ledger: Pin Private Diagnostics Directory on Linux

## Design Judgment Day — Round 1

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| JD-DESIGN-001 | judgment-day | `design.md:13-15,38-42` | CRITICAL | fixed | Both blind judges found a pre-acceptance mutation window: content and entry-stability checks finish before final caller-alias validation, but that alias check proves only directory identity. A same-directory child mutation between those steps can escape detection before acceptance. |
| JD-DESIGN-002 | judgment-day | `design.md:74-76` | CRITICAL | info | Single-judge suspect only: the two implementation work units lack explicit merge-safe intermediate behavior, verification, and rollback boundaries. It does not independently trigger a fix without convergence. |

- Judges A and B returned `JUDGMENT: BLOCKED` on `JD-DESIGN-001`.
- Required correction: surround final alias acquisition with anchored state validation and perform a final descriptor-rooted recheck after alias identity validation before acceptance.
- `JD-DESIGN-002` remains a nonblocking first-pass signal for task-boundary design.
- Round 1 fix (`JD-DESIGN-001`) — see scoped re-judgment below: `design.md` Technical Approach, Entry stability, Child defense, and Linearization rows now order content/child checks → anchored pre-alias recheck → alias `dev`/`ino` identity check only (`V_DIRECTORY`) → final descriptor-rooted recheck with all FDs held (`V_RACE`) → accept; the sequence diagram mirrors that order, and the Races row adds same-A child write/replacement and pair add/remove at both windows.

## Design Judgment Day — Round 1 Scoped Re-judgment

Target: frozen round-1 ledger (sha256 `cb2e6086…e4ecb6`) plus fix delta `design.md` `11535e74…788b0c` → `3a0ab230…fe61c64`.

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| JD-DESIGN-003 | judgment-day | `design.md:15,63` | WARNING | addressed | Both judges: the Linearization row places linearization at step-4 success and claims acceptance "with alias=A", but alias identity is observed only at step 3; step 4 rechecks descriptor-rooted state and never re-resolves the caller path (for example, an ancestor rename between steps 3 and 4 goes undetected). The provable point is the step-3 alias observation bracketed by equal anchored states (steps 2 and 4). Races has no alias-change case at alias→acceptance. Causal: introduced by the round-1 fix. |
| JD-DESIGN-004 | judgment-day | `design.md:14-15,63` | WARNING | addressed | Both judges: same-A in-place child write detection is metadata-only (`size`, `mtimeNs`, `ctimeNs`); with coarse timestamp granularity a same-size write in the same tick passes steps 2 and 4, yet the Races row claims deterministic `V_RACE` without requiring a size change or distinct tick. Causal: pre-existing mechanism (Judge A), claim worsened by the fix (Judge B). |
| JD-DESIGN-005 | judgment-day | `design.md:15,63` | SUGGESTION | addressed | Both judges: alias reopen failure (`ENOENT`, `ELOOP`, `ENOTDIR`) and anchored lookup failures during steps 2/4 have no error class; Races expects `V_DIRECTORY` for final A→B, which usually fails the open rather than mismatching. Pre-existing. |

- Both judges confirm `JD-DESIGN-001` is closed; neither reports a CRITICAL finding.
- Severe budget: round 1 of 2 used; no confirmed severe finding remains, so no round-2 fix runs.
- Terminal verdict: `JUDGMENT: APPROVED` with three `info` rows. The verdict carries no delivery authority.

## Post-verdict Design Revision

Ordinary design edit requested by the maintainer after `JUDGMENT: APPROVED`; it consumes no Judgment Day round and has not been re-judged. `design.md` `3a0ab230…fe61c64` → `7f883c19…35cd37` (795 words, under the 800-word budget).

- `JD-DESIGN-003`: Linearization now claims only that the caller path named A at step 3, recorded metadata held at steps 2 and 4, and recorded content held at step 4; later caller-path changes (such as ancestor renames) are outside the claim. Races asserts that an ancestor rename after step 3 leaves the result unchanged.
- `JD-DESIGN-004`: new Content binding row: step 4 re-reads each retained child FD from offset 0 and requires its recorded SHA-256. Races adds a same-size write with timestamps frozen through the `fs` seam. Forecast raised to 440–585 lines.
- `JD-DESIGN-005`: new Error mapping row: alias open/`fstat` failure (`ENOENT`, `ELOOP`, `ENOTDIR`, `EACCES`), non-directory, or mismatch is `V_DIRECTORY`; any step-2/4 lookup, read, metadata, or digest failure is `V_RACE`. Races covers alias renamed away, replaced, or symlinked.
- Word budget: the redundant sequence diagram was removed (the Linearization row carries the ordered steps), and the mode-dispatch table, file list, alternatives, and assumptions were condensed without changing their outcomes.

## Post-verdict Revision Review

Target: frozen ledger `f7324e4a…7a04e8`, delta `design.md` `3a0ab230…fe61c64` → `7f883c19…35cd37`, spec `2e0a73b3…038d2` (consistency only). Locations refer to the revised `design.md`.

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| JD-DESIGN-006 | judgment-day | `design.md:36` | WARNING | addressed | Both judges: the Races row lost injection timing. "Each before and after step 3" includes placements before the step-1 read or classification that cannot yield `V_RACE`; alias rename timing is unstated, although only a rename between steps 2 and 3 deterministically yields `V_DIRECTORY` (earlier renames change A's stamp and yield `V_RACE`); the standalone same-A pair add/remove case was dropped. Introduced by the revision. |
| JD-DESIGN-007 | judgment-day | `design.md:23-25` | WARNING | addressed | Both judges: condensing mode dispatch changed approved outcomes. It dropped "semantics" from snapshot parity, "all parent rules", the explicit pair-without-context and context-without-pair `E_AUTH` cases, and the standalone classification-change row; "Same;" now inherits the no-context row; probe-observed evidence became "Immediate" `V_CAPABILITY`. The revision section's "without changing their outcomes" claim is wrong. Introduced by the revision. |
| JD-DESIGN-008 | judgment-day | `design.md:14,16` | WARNING | addressed | Both judges (Judge A WARNING, Judge B SUGGESTION): the approved binding "`fstat` equals anchored `lstat` and pre-read metadata" was removed and steps 2/4 now say only "child metadata", so a same-tick rename-over replacement of a non-evidence child is no longer required to be detected (the digest re-reads the retained old inode). Introduced by the revision. |
| JD-DESIGN-009 | judgment-day | `design.md:17` | SUGGESTION | addressed | Both judges: the errno list is not marked exhaustive or illustrative; resource and I/O errors (`EMFILE`, `ENFILE`, `EIO`) would report an unsafe directory or a changed bundle. Introduced by the revision. |
| JD-DESIGN-010 | judgment-day | `design.md:13,17,23-24` | WARNING | addressed | Judge B only: read literally, "any step-2/4 lookup failure is `V_RACE`" turns the expected `ENOENT` of a recorded-absent evidence basename into `V_RACE`, breaking pinned legacy and `E_AUTH` paths. Introduced by the revision. |
| JD-DESIGN-011 | judgment-day | `design.md:15-16` | SUGGESTION | addressed | Judge A only: Content binding omits read-to-EOF and its order relative to the step-4 metadata recheck; an append between those sub-steps could pass. Introduced by the revision. |
| JD-DESIGN-012 | judgment-day | `design.md:30,43` | SUGGESTION | addressed | Judge B only: the revision holds content digests but the message rule no longer names proc paths and does not forbid digests in messages. Introduced by the revision. |

- Neither judge reports a CRITICAL finding; both find JD-DESIGN-003/004/005 addressed in substance.
- Correction to the revision section above: the condensation did change approved outcomes (JD-DESIGN-006/007/008).
- Severe budget: round 2 of 2 not consumed. Verdict: `JUDGMENT: APPROVED` with seven `info` rows; no delivery authority.

## Second Post-verdict Design Revision

Ordinary design edit requested by the maintainer; consumes no Judgment Day round and has not been re-judged. `design.md` `7f883c19…35cd37` → `355afc04…783cdc` (1181 `wc -w` words). Budget exception: by maintainer decision the design exceeds the 800-word guide so contract qualifiers stay exact; the design records the exception under Scope.

- Base restored: every approved row the first revision condensed returns verbatim from `3a0ab230…fe61c64` (Capability, Acquire/prove, mode dispatch, sequence diagram, file table, Alternatives, Assumptions, Sources) or carries each approved qualifier forward.
- `JD-DESIGN-006`: Races now pins injection windows: pair add/remove after classification and before step 2; alias rename-away/replacement/symlink between steps 2 and 3 (`V_DIRECTORY`); child write, frozen-timestamp same-size write, rename replacement with unchanged stamp, and pair add/remove between step 1's last content check and step 3 and between steps 3 and 4 (`V_RACE`); append inside step 4; pre-read mutations are input, not races.
- `JD-DESIGN-007`: mode-dispatch table restored verbatim (snapshot order/semantics, all parent rules, explicit `E_AUTH` cases, standalone classification-change row, Immediate versus Same `V_CAPABILITY`).
- `JD-DESIGN-008`: Child defense requires, at steps 2 and 4, each read child's anchored `lstat` to equal its retained FD's `fstat` and pre-read metadata, including legacy five-file members.
- `JD-DESIGN-009`: Error mapping lists the `V_DIRECTORY` and `V_RACE` errnos explicitly; any other errno (`EMFILE`, `ENFILE`, `EIO`, `ENOMEM`) propagates unclassified to the existing generic CLI failure (verified: the wrapper at `scripts/verify-private-local-diagnostics-artifact.mjs` catches all errors and writes a fixed stderr line) and is never relabeled.
- `JD-DESIGN-010`: a basename recorded absent must remain absent; its `ENOENT` is the expected state. Classification tests keep a recorded-absent pair in legacy through steps 2 and 4.
- `JD-DESIGN-011`: step 4 runs the metadata recheck first, then re-reads each retained child FD from offset 0 to EOF and requires the recorded byte count and SHA-256.
- `JD-DESIGN-012`: messages expose no path, FD, proc path, metadata, or digest.
- Forecast raised to 450–595 lines; two stacked-to-main units unchanged.
