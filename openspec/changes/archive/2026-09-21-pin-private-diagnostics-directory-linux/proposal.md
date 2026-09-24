# Proposal: Pin Private Diagnostics Directory on Linux

## Intent

Amend P2 of `authorize-private-diagnostics-artifact` against an in-scope local directory renamer. Replace blocked PR #25 from merged P1 (`907ba852190a283b04dc2ee75050aa5505393da4`); retain P0/P1 and block P3.

## Current Gap and Security Outcome

PR #25 uses mutable `artifactDir` paths. Metadata fixes reject A→B and same-directory insertion, not A→B→A: reads traverse B while the final check sees restored A. After two rounds, Judgment Day ended `ESCALATED`; runtime ordinal 15 failed. Node core lacks portable `openat`/`fstatat` or directory-FD child lookup. Metadata, retries, copies, and locks do not defeat ABA.

Pin one directory identity from discovery through completion; fail final pathname mismatch. Evidence remains unsigned/remintable, not owner authentication.

## Scope

### In Scope
- Evidence mode alone is unsupported outside Linux with usable `/proc/self/fd` and fails closed with an explicit platform/capability error.
- On the Linux/procfs-capable flow, open/pin the directory before canonical-evidence discovery. Bind mode selection and every relevant later bundle-child read—including legacy verification after evidence-free selection—to the same FD via `/proc/self/fd/<fd>/<safe-basename>`; reject final caller-path alias mismatch.
- Add ABA and final-alias-mismatch regressions.
- Preserve frozen four-argument legacy behavior and output on supported platforms.

### Out of Scope
- Native helpers/addons, portable `openat`, CLI redesign, producer changes, host-path resolution, locks, copies, retries, or archive execution.
- Network, signer, trust anchor, custody, authenticated approval, P3, build, pack, release, or deploy.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `private-diagnostics-authorization-evidence`: Pin discovery, selection, and relevant child reads on Linux/procfs; fail closed without evidence capability; preserve legacy output.

## Approach

Use the approved Linux/procfs direction without portability claims. Preserve legacy semantics after evidence-free selection. Separate stacked-to-main planning/implementation PRs remain within 400 lines.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/private-local-diagnostics-verification-lib.mjs` | Modified | Traversal/capability contract |
| `scripts/verify-private-local-diagnostics-artifact.test.mjs` | Modified | ABA/platform regressions |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Procfs unavailable | Medium | Probe capability and fail closed explicitly |
| Legacy compatibility regression | Low | Freeze and regress exact legacy behavior/output |
| Security overclaim | Medium | Report unsigned structural evidence only |

## Rollback and Supersession

Revert replacement P2 while retaining P1 and blocking P3. This amends parent P2 requirements and supersedes only PR #25's implementation—not P1 contract/history. Closing PR #25, implementation, commits, pushes, and new PRs each require separate maintainer authorization.

## Dependencies

- Merged P1; Linux with accessible `/proc/self/fd` for evidence mode.

## Success Criteria

- [ ] Deterministic A→B→A cannot read children from B while ending on A.
- [ ] Held A with caller pathname ending at B fails closed.
- [ ] Unsupported evidence-mode environments return an explicit error; legacy behavior/output remains exact.
