# Archive Report: Pin Private Diagnostics Directory on Linux

## Closure

This archive closes the OpenSpec change after independent verification passed. The canonical specification now includes the delta requirements; the archived change preserves its original artifacts byte-for-byte before this additive report.

## Final State

| Item | Final value |
|---|---|
| Tasks | 24/24 complete |
| Requirements | 3/3 compliant |
| Scenarios | 8/8 compliant |
| Verification | PASS; 38/38 focused tests; zero findings |
| Runtime evidence | `TMPDIR=/tmp/opencode node --test scripts/verify-private-local-diagnostics-artifact.test.mjs` exited 0 |
| Verification report SHA-256 | `c76af1f4648123b0d4cfa83d0e5046cb5e7d30d9672138c3d78061d0b23277fa` |
| Final evidence revision | `sha256:ad742cd7d375ae3c7694c8fcd6f8bfa85deb05a386a6c7def70d03c36abf9021` |
| Remediated evidence revision | `sha256:30746904e8a84b52254d45a2f867cfb9154da52d4afa48d04619c0b1d8ecd304` |
| Settled verification token | `e500b29a7b5c9e067404b7c3cffacfe94f14247b7910e6b374e6b8f8e9ff9516` (`verify-20260920-opencode-final-settle-1`, COMPLETE) |
| HEAD at verification | `ae5f6bd82d0250f85d151892815179627e9322af` |

The final-state facts supersede intermediate apply and verification snapshots where their counts or open-gap language differs. The three test-only evidence additions establish restored-alias ABA behavior in both modes, retained A-byte and FD identity, final-alias mutation rejection, and frozen legacy five-file/CLI behavior. No production source change is included in this archive operation.

## Specification Sync

| Domain | Action | Result |
|---|---|---|
| `private-diagnostics-authorization-evidence` | Created canonical spec mechanically from the delta | 1 added requirement, 2 modified requirements, 3 requirements, 8 scenarios |

The canonical path is `openspec/specs/private-diagnostics-authorization-evidence/spec.md`.

## Mechanical Archive Evidence

The source change directory was recursively snapshotted under `/tmp/opencode` before moves. All `diff -r` output was empty and each command exited 0.

```text
cp -R openspec/changes/pin-private-diagnostics-directory-linux "$snapshot_root/source"
exit: 0

cp openspec/changes/pin-private-diagnostics-directory-linux/specs/private-diagnostics-authorization-evidence/spec.md "$temp_path"
exit: 0

diff -r openspec/changes/pin-private-diagnostics-directory-linux/specs/private-diagnostics-authorization-evidence/spec.md "$temp_path"
output: empty
exit: 0

mv "$temp_path" openspec/specs/private-diagnostics-authorization-evidence/spec.md
exit: 0

mv openspec/changes/pin-private-diagnostics-directory-linux openspec/changes/archive/2026-09-21-pin-private-diagnostics-directory-linux
exit: 0

diff -r "$snapshot_root/source" openspec/changes/archive/2026-09-21-pin-private-diagnostics-directory-linux
output: empty
exit: 0
```

## Archived Contents

- `proposal.md`
- `specs/private-diagnostics-authorization-evidence/spec.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`
- `archive-report.md` (this additive record)

## Engram Traceability

Read observations: proposal #8871; spec #8933; design #8988; tasks #9611; apply-progress #9631; verify-report #9951.

## Delivery Boundary

The local uncommitted test-only diff remains preserved: `scripts/verify-private-local-diagnostics-artifact.test.mjs` is `+194/-2`. `.atl/` remains untracked. Neither is staged, committed, pushed, or represented as a delivery by this archive.

## Risks

- The archive closes specification workflow only; it does not deliver the remaining local test diff.
- The archive report is additive and was intentionally excluded from the pre-report source/archive byte-identity comparison.
