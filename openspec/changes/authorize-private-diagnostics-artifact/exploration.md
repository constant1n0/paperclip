## Exploration: authorize-private-diagnostics-artifact

### Current State
`fork/master@2f817a25f0541a07760415ee6723f5a79742417c` produces a five-file staged set: `<id>.tgz`, immutable receipt v1 plus SHA-256 sidecar, and verification manifest v1 plus SHA-256 sidecar. The receipt contract strictly requires `authorization`, `storage`, and `signature` to be `null`; it must not be extended or rewritten.

`scripts/verify-private-local-diagnostics-artifact.mjs` delegates to a static, rebuild-free verifier. Its existing invocation accepts exactly `--artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME`, rejects symlinks for the directory and each read file, snapshots with `O_NOFOLLOW`, requires canonical JSON and sidecars, cross-binds receipt/verification/archive digests, and statically inspects the archive without executing archive-controlled JavaScript. `--require-authorized` is currently rejected.

The producer writes only to an empty real directory outside the checkout and atomically renames its five files after trusted producer smoke. It does not establish custody, ACLs, immutability, human case approval, authorization, storage, signatures, release, or distribution.

The only tracked signing mechanism found is keyless Cosign in `.github/workflows/agent-runtime-images.yml`. It signs pushed GHCR agent-runtime image digests from GitHub Actions OIDC; the repository defines neither a detached-file authorization signature, its public trust-anchor distribution, nor offline revocation verification. The existing tool-action HMAC is instance-secret verification for tool calls, not a distributable public-key authorization mechanism, and is prohibited for this artifact because it would require a model-inaccessible runtime secret. Neither mechanism is reusable as-is.

### Affected Areas
- `scripts/private-local-diagnostics-artifact-lib.mjs` — receipt v1 contract remains unchanged; shared canonical JSON and safe filename/hash helpers can support a separate contract without modifying receipt semantics.
- `scripts/private-local-diagnostics-verification-lib.mjs` — retain the legacy verifier path and add an opt-in, fail-closed structural-evidence mode.
- `scripts/verify-private-local-diagnostics-artifact.mjs` and `package.json` — expose evidence-mode context only without changing legacy invocation or result behavior.
- `scripts/*artifact*.test.mjs` — cover mode selection, closed schema, exact context binding, time interval, arbitrary inspection-directory defenses, and no-execution behavior.
- CLI/result documentation in the verifier behavior slice — distinguish human case approval from unsigned structural artifact evidence; the operator manual is not edited in this design-fix round.
- `openspec/changes/authorize-private-diagnostics-artifact/` — proposal/spec/design/tasks distinguish repository behavior from Placa B HUMAN-OPS.

### Approaches
1. **Separate unsigned authorization-evidence manifest with strict structural verification** — keep receipt v1 unchanged; optionally validate `<artifact-id>.authorization.json` and its SHA-256 sidecar beside a copied five-file set. The verifier reports only unsigned structural evidence; `--require-authorized` remains rejected.
   - Pros: preserves receipt immutability and legacy verification; prevents cross-file and cross-case swaps; makes the lack of an authentic authorization mechanism explicit; no secret or signing system is invented.
   - Cons: does not permit an automated human-approval decision; a verified signing and revocation authority remains a blocker.
   - Effort: Medium.

2. **Treat custody ACL/immutable flags as authorization** — let `--require-authorized` pass based only on canonical path, root ownership, ACL, and immutable inode checks.
   - Pros: can be implemented without a signing service.
   - Cons: filesystem controls prove local custody posture, not owner intent or a current, revocable grant; platform-specific checks are not verifiable in this repository. This would overclaim authorization.
   - Effort: Medium, unacceptable security semantics.

3. **Add a verified external signing/revocation authority first** — define a signer, key lifecycle, trusted public-key distribution, revocation source, and offline verification evidence, then allow `--require-authorized` to pass only for a valid non-revoked signature.
   - Pros: gives human approval an auditable cryptographic meaning and supports expiry/revocation.
   - Cons: requires an owner-approved security design and HUMAN-OPS key lifecycle; outside the current verified repository contract.
   - Effort: High.

### Recommendation
Scope this change to **unsigned structural artifact evidence only**: adopt approach 1, keep receipt v1 immutable, and do not have the producer generate human case approval or privileged custody evidence. The verifier has two backward-compatible modes:

- **Legacy staged mode:** when neither `<artifact-id>.authorization.json` nor `<artifact-id>.authorization.json.sha256` is present and no evidence-context argument is supplied, accept only the existing two arguments and preserve the existing five-file verification and result unchanged.
- **Authorization-evidence mode:** when either canonical authorization-evidence file is present or any of `--audience`, `--case-id`, or `--incident-id` is supplied, fail closed unless the complete canonical pair and complete expected context are present.

`SAFE_ID` is the closed ASCII grammar `[A-Za-z0-9][A-Za-z0-9_-]{0,127}` (one through 128 characters). Manifest `caseId`, expected `--case-id`, manifest Optimus `incidentId`, and expected `--incident-id` MUST use it; empty, control, path, and overlong values are rejected. Evidence-mode context has one exact grammar: Hefesto requires exactly `--audience hefesto --case-id CASE_ID` and rejects any `--incident-id`; Optimus requires exactly `--audience optimus --case-id CASE_ID --incident-id INCIDENT_ID`, where both IDs are nonempty `SAFE_ID` values and differ. Missing, duplicate, unexpected, or manifest-mismatched context fails closed. Expected-context checks reject mismatched or stale use; they are not cryptographic replay prevention. `--require-authorized` remains rejected/reserved, and final artifact publication remains prohibited, until a separate owner decision provides a verified external signing and revocation design.

Proposed authorization-evidence manifest (canonical JSON, exact closed fields) is:

```json
{
  "schemaVersion": 1,
  "artifactId": "ARTIFACT_ID",
  "receipt": { "filename": "ARTIFACT_ID.receipt.json", "sha256": "LOWERCASE_SHA256" },
  "verification": { "filename": "ARTIFACT_ID.verification.json", "sha256": "LOWERCASE_SHA256" },
  "artifact": { "filename": "ARTIFACT_ID.tgz", "sha256": "LOWERCASE_SHA256", "bytes": 1 },
  "storage": {
    "custodyRoot": "/home/dcm/CUSTODIA-ABSOLUT/private-artifacts/paperclip-local-diagnostics",
    "locator": "/home/dcm/CUSTODIA-ABSOLUT/private-artifacts/paperclip-local-diagnostics/ARTIFACT_ID"
  },
  "grant": {
    "ownerAuthorizationRef": "OWNER_CONTROLLED_REFERENCE",
    "caseId": "CASE_ID",
    "incidentId": null,
    "audience": { "principal": "hefesto", "mode": "normal" },
    "issuedAt": "RFC3339_UTC",
    "expiresAt": "RFC3339_UTC"
  },
  "revocation": { "status": "unverified", "reference": "OWNER_CONTROLLED_REFERENCE" },
  "signature": null
}
```

The companion pathname is exactly `<artifact-id>.authorization.json.sha256`; its content is exactly `<lowercase-sha256><two spaces><artifact-id>.authorization.json\n`. Evidence discovery and pair completeness use those two pathnames only. The manifest binds the current receipt and verification-manifest byte digests and the receipt tarball identity/digest/size; its `artifactId` and basenames must match. `storage.custodyRoot` and `storage.locator` are declarative canonical strings: the former is the approved Placa B root and the latter is exactly that string plus `/` and `artifactId`. They are not resolved, required to exist, or compared to `--artifact-dir` on the verifier host. The supplied `--artifact-dir` remains any real absolute inspection directory subject to the current no-follow, containment, link, inode, and changed-during-read protections. Reject traversal, backslashes, noncanonical JSON, unknown fields, mismatched sidecars, symlinks, hard links (`nlink !== 1`), nonregular files, changed-during-read files, or cross-file disagreement.

Grant semantics: timestamps are RFC3339 UTC and `issuedAt < expiresAt`. Capture the verifier clock once per evidence-mode invocation and require `issuedAt <= verificationTime < expiresAt`. Do not infer identity from process or model context. `hefesto` maps only to `hefesto/normal`; its `incidentId` is exactly `null`. `optimus` maps only to `optimus/break-glass`; its nonempty `incidentId` is distinct from and exactly bound to explicit expected `caseId` and `incidentId` inputs. An immutable authorization-evidence manifest cannot learn later revocation: `revocation.status: unverified` and `signature: null` mean structurally present but unauthenticated. The structural verifier can report `authorizationEvidence: "unsigned"`; this is structural integrity and self-consistency only, never HUMAN-OPS human case approval. An attacker able to rewrite the unsigned bundle can remint its manifest and sidecar; only a future external trust anchor and signature can authenticate owner intent or resist that attack. It must never treat `null`, `unsigned`, a sidecar, custody flags, or a model-provided reference as a signature.

Placa B custody controls and any custody-evidence record remain documentation-only/HUMAN-OPS. This change does not parse, accept, validate, return, or enforce such a record; it does not claim root ownership, ACLs, immutable flags, backups, or restore checks are live. No repository script may expose an account password, Secret Key, generic shell/op/item-read capability, gateway-wide secret environment, artifact blobs, or model-visible credential.

### Risks
- **Swapped, stale, or reminted evidence:** bind authorization evidence to receipt/verification/tarball bytes and to explicit expected audience, case, and (for Optimus) incident; capture one clock and enforce its complete validity interval. These checks reject mismatched or stale use, but an attacker who can rewrite the unsigned bundle can remint its manifest and sidecar. Unsigned evidence cannot authenticate owner intent or prove human approval; that requires a future external trust anchor and signature.
- **Filesystem substitution:** preserve current inspection-directory defenses. Custody strings are declarative metadata, so a verifier can inspect an independently secured copy without Placa B being mounted.
- **Custody overclaim:** do not add a runtime custody-evidence parser or validator; HUMAN-OPS records and enforces custody separately.
- **Credential escalation:** do not add generic secrets, storage APIs, network fetches, or public distribution.
- **Scope confusion:** static verifier tests must continue proving untrusted payload is never executed; trusted producer smoke remains separate. No final artifact generation, packing, release, tag, npm publication, GitHub Release, or Engram blob distribution may occur before all slices merge and authenticated approval is separately designed.

### Ready for Proposal
Yes. The proposal is limited to structural artifact evidence: canonical authorization-evidence manifest/sidecar, immutable cross-binding, explicit expected audience/case/incident context, interval validation, and a declarative-only Placa B storage assertion. It preserves legacy five-file verification and result behavior, `--require-authorized` rejection, and the publication prohibition. Expected context detects mismatched or stale use, not cryptographic replay. An attacker able to rewrite the unsigned bundle can remint its manifest and sidecar. A separate owner decision is required before a later change can authenticate human approval, resist that attack, or enable `--require-authorized` success: select an external trust anchor, signer, public-key distribution, detached-signature format, and offline fail-closed revocation evidence.

### Proposed Stacked-to-Main Slices
1. **PR 1 — evidence contract and unit tests** (target `main`, estimated <= 350 changed lines): isolated canonical manifest/sidecar-pair parser, closed schema including safe `caseId`/`incidentId`, canonical declarative storage strings, captured-clock policy, and exact expected-context/cross-binding helpers. Verify with Node unit tests only; rollback reverts the isolated library.
2. **PR 2 — static verifier, CLI/result documentation, and adversarial tests** (target `main` after PR 1, estimated <= 400 lines): preserve legacy mode unchanged; activate evidence mode only for the complete canonical pair and exact CLI context grammar; retain arbitrary inspection-directory snapshots and report `authorizationEvidence: "unsigned"` with case/incident. Document structural integrity/self-consistency and that unsigned evidence neither authenticates owner intent nor equals human case approval. Keep `--require-authorized` rejected. Verify focused mode, mismatched/stale-context, remint-boundary, and malicious-payload tests; rollback reverts verifier wiring and its documentation together.
3. **PR 3 — boundary integration tests** (target `main` after PR 2, estimated <= 300 lines): prove the exact five-file producer/legacy verifier regression and that custody remains outside runtime acceptance or validation. Verify focused script tests; no build, pack, generated artifact, deployment, or operator-manual edit in this design-fix round.

Each slice is independently reviewable, carries its tests/docs with its behavior, and uses the selected stacked-to-main strategy. PR 2 and PR 3 must not be opened or merged until their parent is merged; no `size:exception` is proposed.
