# Delta for Private Diagnostics Authorization Evidence

Amends P2; supersedes blocked PR #25 only. P1 retained; P3 blocked.

## ADDED Requirements

### Requirement: Linux-Pinned Evidence Traversal

Evidence-capable verification MUST require Linux and usable `/proc/self/fd`. Acquiring and holding the validated directory FD establishes the directory-identity anchor. The verifier MUST select mode and read every relevant canonical and five-file child through that anchor, retaining it through completion. Verification MUST accept only after descriptor-rooted discovery/classification, hardened child reads and cross-bind checks, evidence-state/directory-entry stability checks, and final caller-path alias validation complete against that anchor. Mutations observed before acceptance MUST fail closed. Existing no-follow, nonblocking, type, link, identity, and complete-read checks MUST apply. Endpoint metadata and unbound probes are insufficient.

#### Scenario: Pinned bundle

- GIVEN Linux/procfs and a complete canonical pair in directory A
- WHEN evidence verification runs with A held
- THEN discovery and relevant reads MUST use A and return unsigned structural evidence only

#### Scenario: ABA or pair mutation is rejected

- GIVEN A is held and a renamer performs A→B→A, A→B, or adds/removes a canonical pair in A
- WHEN verification observes the changed identity, classification, child, or final alias
- THEN it MUST fail closed

#### Scenario: Unsafe final state

- GIVEN A is held, the final alias resolves to B, or input/child is non-directory or unsafe
- WHEN verification runs
- THEN it MUST reject the request

## MODIFIED Requirements

### Requirement: Backward-Compatible Verification Modes

When no canonical authorization pathname is stably observed and no evidence-context argument is supplied, the verifier MUST preserve frozen four-argument five-file path, result, output grammar, and snapshot. Either pathname or context argument MUST activate evidence mode. On Linux/procfs, selection MUST use the held directory. Outside that capability, evidence mode MUST fail closed with an explicit unsupported-platform/capability error. Stably observed complete/partial evidence, or mutation that makes classification unreliable, MUST also fail closed with that error. Legacy compatibility applies only to stable evidence-free invocations and makes no cross-platform rename-safety claim.

(Previously: mode selection used inspection-directory pathnames without Linux descriptor pinning or capability boundary.)

#### Scenario: Legacy staged verification is unchanged

- GIVEN a stable evidence-free five-file set and only the current four arguments
- WHEN verification runs
- THEN it MUST preserve the frozen legacy result, output grammar, and snapshot

#### Scenario: Context requests unavailable evidence mode

- GIVEN non-Linux, missing, or restricted procfs and evidence-context input
- WHEN verification runs
- THEN it MUST reject with the explicit unsupported-platform/capability error

#### Scenario: Unavailable capability observes evidence

- GIVEN that environment observes complete/partial canonical evidence or inconsistent classification
- WHEN verification runs without context
- THEN it MUST reject with the explicit unsupported-platform/capability error

### Requirement: Independent Inspection and Declarative Storage

`--artifact-dir` MUST remain an arbitrary absolute real inspection directory protected by existing no-follow, containment, regular-file, single-link, inode, and changed-during-read defenses. On Linux evidence-capable verification, they MUST operate on descriptor-rooted held-directory children. The verifier MUST derive basenames from validated `artifactId` and MUST NOT require the directory to resolve from Placa B custody. `storage.custodyRoot` MUST equal `/home/dcm/CUSTODIA-ABSOLUT/private-artifacts/paperclip-local-diagnostics`; `storage.locator` MUST equal that string plus `/` and `artifactId`. Both are declarative and MUST NOT be filesystem-resolved. Custody evidence remains documentation-only/HUMAN-OPS: this change MUST NOT parse, accept, validate, return, or enforce it.

(Previously: inspection defenses did not require descriptor-rooted traversal for Linux evidence-capable verification.)

#### Scenario: Independently secured copy is accepted

- GIVEN a valid staged set in a protected arbitrary absolute inspection directory
- WHEN declarative storage strings match the approved root and artifact ID
- THEN the verifier SHALL inspect that directory without resolving the locator

#### Scenario: Unsafe inspection or noncanonical storage is rejected

- GIVEN an unsafe inspection path or a storage root/locator differing from the fixed canonical strings
- WHEN verification runs
- THEN the verifier MUST reject the input

## Retained Parent Requirements

Parent grammar, one clock, context/time/replay/cross-bind, and unsigned output remain. Static only: no archive execution, network, or trust claim.
