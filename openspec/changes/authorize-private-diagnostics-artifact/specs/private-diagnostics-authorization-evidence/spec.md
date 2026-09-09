# Private Diagnostics Authorization Evidence Specification

## Purpose

Define unsigned structural artifact evidence for a private diagnostics artifact. This specification MUST NOT claim authenticated human case approval, current revocation, or custody enforcement.

## Requirements

### Requirement: Backward-Compatible Verification Modes

When neither `<artifact-id>.authorization.json` nor `<artifact-id>.authorization.json.sha256` exists in the inspection directory and none of `--audience`, `--case-id`, or `--incident-id` is supplied, the verifier MUST accept only its current arguments and preserve the existing five-file staged verification and result behavior unchanged. The presence of either canonical authorization-evidence pathname or any evidence-context argument MUST activate authorization-evidence mode. In that mode, the verifier MUST fail closed unless the complete canonical pair exists: `<artifact-id>.authorization.json` and `<artifact-id>.authorization.json.sha256`, with complete expected context.

#### Scenario: Legacy staged verification is unchanged

- GIVEN a valid existing five-file set and only the current verifier arguments
- WHEN verification runs
- THEN it MUST use the existing verification path and preserve its result behavior

#### Scenario: Partial evidence mode is rejected

- GIVEN either one authorization file or any evidence-context argument
- WHEN both files and complete expected context are not present
- THEN the verifier MUST reject the request

### Requirement: Closed Canonical Authorization Evidence

The system MUST accept only canonical JSON with exactly these fields: `schemaVersion`, `artifactId`, `receipt`, `verification`, `artifact`, `storage`, `grant`, `revocation`, and `signature`. `schemaVersion` MUST be `1`; nested fields MUST exactly match the v1 shape: receipt/verification `filename` and lowercase `sha256`; artifact `filename`, lowercase `sha256`, and positive `bytes`; storage `custodyRoot` and `locator`; grant `ownerAuthorizationRef`, `caseId`, `incidentId`, audience `principal`/`mode`, `issuedAt`, `expiresAt`; revocation `status: "unverified"` and `reference`; and `signature: null`. `caseId` MUST match `SAFE_ID = [A-Za-z0-9][A-Za-z0-9_-]{0,127}`; `incidentId` MUST be exactly `null` for Hefesto or a `SAFE_ID` value for Optimus. This closed grammar is nonempty, ASCII-only, and bounded to 128 characters; it rejects controls and path characters. Its sidecar pathname MUST be exactly `<artifact-id>.authorization.json.sha256`, and its content MUST be exactly `<lowercase-sha256><two spaces><artifact-id>.authorization.json\n`.

#### Scenario: Canonical evidence is accepted

- GIVEN a v1 manifest with only the specified fields and a matching sidecar
- WHEN complete evidence-mode context matches its policy
- THEN the evidence SHALL be structurally valid and report `authorizationEvidence: "unsigned"`

#### Scenario: Noncanonical evidence is rejected

- GIVEN a manifest with an unknown field, invalid `incidentId`, noncanonical JSON, malformed sidecar, or digest mismatch
- WHEN evidence-mode verification is requested
- THEN the verifier MUST reject the evidence

### Requirement: Immutable Artifact and Expected-Context Binding

The manifest MUST bind its artifact ID and basenames to receipt v1, verification manifest v1, and tarball filename, SHA-256 digest, and byte count. Receipt v1 `authorization`, `storage`, and `signature` MUST remain null. The producer MUST remain a five-file output and MUST NOT issue human case approval. Evidence mode MUST accept exactly one expected-context grammar. Hefesto requires exactly one `--audience hefesto` and one `--case-id CASE_ID`, where `CASE_ID` matches `SAFE_ID`; it MUST reject any `--incident-id`. Optimus requires exactly one `--audience optimus`, one `--case-id CASE_ID`, and one `--incident-id INCIDENT_ID`, where both values match `SAFE_ID` and `INCIDENT_ID` differs from `CASE_ID`. Each corresponding manifest value MUST exactly match its expected input; the Hefesto manifest `incidentId` MUST be `null`. Missing, duplicate, unexpected, or mismatched context MUST fail closed. No ambient or model identity MAY supply expected context. Expected-context checks reject mismatched or stale use; they are not cryptographic replay prevention. The structural result MUST return the matched `caseId` and `incidentId`.

#### Scenario: Bound Hefesto evidence is accepted

- GIVEN all files and hashes match and explicit Hefesto audience/case context matches
- WHEN structural verification runs
- THEN it SHALL return unsigned evidence with that case ID and null incident ID

#### Scenario: Same-audience cross-case mismatch is rejected

- GIVEN structurally valid evidence for the correct audience but another case or incident
- WHEN expected context is supplied for a different case or incident
- THEN the verifier MUST reject the evidence

### Requirement: Single-Clock Time Policy

Evidence-mode verification MUST capture its verification time exactly once. Timestamps MUST be RFC3339 UTC and `issuedAt` MUST precede `expiresAt`. The verifier MUST require `issuedAt <= verificationTime < expiresAt` using that one captured instant.

#### Scenario: Evidence is within its validity interval

- GIVEN matching evidence whose issued and expiry times surround the captured instant
- WHEN verification runs
- THEN the verifier SHALL accept its time policy

#### Scenario: Future-issued or expired evidence is rejected

- GIVEN evidence issued after or expired at or before the captured instant
- WHEN verification runs
- THEN the verifier MUST reject the evidence

### Requirement: Independent Inspection and Declarative Storage

`--artifact-dir` MUST remain an arbitrary absolute real inspection directory protected by the existing no-follow, containment, regular-file, single-link, inode, and changed-during-read defenses. The verifier MUST derive inspected basenames from validated `artifactId` and MUST NOT require the directory to equal, exist under, or resolve from Placa B custody storage. `storage.custodyRoot` MUST exactly equal `/home/dcm/CUSTODIA-ABSOLUT/private-artifacts/paperclip-local-diagnostics`; `storage.locator` MUST exactly equal that canonical string followed by `/` and `artifactId`. These are declarative strings only and MUST NOT be filesystem-resolved or existence-checked on the verifier host. Custody evidence remains documentation-only/HUMAN-OPS: this change MUST NOT parse, accept, validate, return, or enforce a custody-evidence record.

#### Scenario: Independently secured copy is accepted

- GIVEN a valid staged set in a protected arbitrary absolute inspection directory
- WHEN declarative storage strings match the approved root and artifact ID
- THEN the verifier SHALL inspect that directory without resolving the locator

#### Scenario: Unsafe inspection or noncanonical storage is rejected

- GIVEN an unsafe inspection path or a storage root/locator differing from the fixed canonical strings
- WHEN verification runs
- THEN the verifier MUST reject the input

### Requirement: Human Approval and Publication Boundary

The structural result MUST be `authorizationEvidence: "unsigned"`; it MUST describe structural integrity and self-consistency only, and MUST NOT use that evidence to report or satisfy HUMAN-OPS human case approval. An attacker able to rewrite the unsigned bundle can remint its manifest and sidecar. Only a future external trust anchor and signature can authenticate owner intent or resist that attack. `--require-authorized` MUST remain rejected/reserved and no input MAY produce authenticated authorization. The system MUST NOT add signer, signature verification, trust anchor, current revocation, archive-controlled execution, secrets, fetch helper, Placa B mutation, build, pack, final artifact, publication, tag, npm, or GitHub Release behavior.

#### Scenario: Reserved authorization gate is invoked

- GIVEN any structurally valid authorization-evidence manifest
- WHEN `--require-authorized` is supplied
- THEN the verifier MUST reject the request

#### Scenario: Unsigned evidence is not human approval

- GIVEN null signature, `unverified` revocation, and matching structural evidence
- WHEN verification runs
- THEN it MUST return only unsigned structural evidence and not human case approval
