# Proposal: Authorize Private Diagnostics Artifact

## Intent

Add unsigned structural-integrity and self-consistency evidence without claiming authenticated human case approval, current revocation, or adversarial remint resistance. Receipt v1 remains immutable and the producer unprivileged. An attacker able to rewrite the unsigned bundle can remint its manifest and sidecar; only a future external trust anchor/signature can authenticate owner intent or resist that attack.

## Scope

### In Scope
- Define a closed canonical `<artifact-id>.authorization.json` contract and exactly `<artifact-id>.authorization.json.sha256`, containing `<lowercase-sha256><two spaces><artifact-id>.authorization.json\n`.
- Preserve unchanged legacy five-file staged verification and result behavior when neither authorization file nor evidence-context argument is present.
- Add fail-closed evidence mode for partial files/context and one exact expected-context grammar: Hefesto has audience plus safe case ID and no incident argument; Optimus has audience, safe case ID, and a distinct safe incident ID. Missing, duplicate, unexpected, or mismatched context fails closed.
- Cross-bind immutable bytes to receipt v1, verification manifest v1, and tarball identity, digest, and byte count; validate declarative canonical Placa B storage strings only.
- Update CLI/result documentation in the evidence-mode slice so unsigned structural evidence is never confused with HUMAN-OPS human case approval.

### Out of Scope
- Authenticated human approval, current revocation claims, signer/key creation, trust-anchor distribution, detached signatures, or signature verification.
- Custody-evidence record parsing, runtime validation, enforcement, Placa B mutation, 1Password/Passbolt integration, secrets, deployment, final artifact generation/upload, public npm/tag/GitHub Release, or publication.
- Changing receipt v1 null `authorization`/`storage`/`signature`, the five-file producer output, rejected/reserved `--require-authorized`, or the operator manual in this design-fix round.

## Capabilities

### New Capabilities
- `private-diagnostics-authorization-evidence`: Canonical unsigned structural-integrity evidence, backward-compatible verifier modes, exact expected-context verification, and byte cross-binding.

### Modified Capabilities
- None; no existing main OpenSpec capabilities are present.

## Approach

Add an isolated canonical-pair parser, then extend the static no-execution verifier with two modes. With only the current `--artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME` arguments and no authorization files, it retains the existing five-file path unchanged. Any authorization file or evidence-context argument activates evidence mode and fails closed unless `<artifact-id>.authorization.json` plus `<artifact-id>.authorization.json.sha256` and complete context are present. `SAFE_ID` is `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`; it applies identically to manifest and expected case IDs, and to Optimus incident IDs. Hefesto accepts exactly audience plus case and rejects an incident argument; Optimus accepts audience, case, and distinct incident. Retain the current arbitrary absolute inspection-directory no-follow snapshots; validate `storage.custodyRoot` and `storage.locator` as fixed canonical strings only, without resolving them on the verifier host. Report `authorizationEvidence: "unsigned"`, never `authorized`; expected-context checks reject mismatched/stale use but are not cryptographic replay prevention.

Delivery is three stacked-to-main slices: (1) contract/parser/tests, <=350 lines; (2) verifier, CLI/result documentation, and adversarial tests, <=400; (3) legacy-regression/boundary integration tests, <=300. Retain source branches; each merge requires separate owner authorization.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `scripts/private-local-diagnostics-artifact-lib.mjs` | Modified | Shared safe canonical helpers; receipt unchanged |
| `scripts/private-local-diagnostics-verification-lib.mjs` | Modified | Legacy/evidence mode selection and structural evidence verification |
| `scripts/verify-private-local-diagnostics-artifact.mjs`, `package.json` | Modified | Evidence-context CLI and matching CLI/result documentation |
| `scripts/*artifact*.test.mjs` | Modified | Mode, exact-context, time, declarative-storage, and adversarial coverage |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unsigned evidence mistaken for human approval | Medium | Use `authorizationEvidence: "unsigned"`; retain rejected authorization gate and document the distinction in the same slice |
| Swap, stale use, or same-audience cross-case mismatch | Medium | Bind evidence bytes and exact expected audience, case ID, and conditional distinct incident ID; this is not cryptographic replay prevention |
| Future-issued or expired evidence accepted | Medium | Snapshot one verification clock and require `issuedAt <= verificationTime < expiresAt` |
| Copied artifact cannot be inspected | Medium | Keep inspection directory independent; storage values are declarative strings only |

## Rollback Plan

Revert each slice independently. Removing evidence mode leaves the existing five-file producer and verifier contract unchanged.

## Dependencies

- None within this structural-only proposal. A later owner decision and separate change are required before authenticated human approval, adversarial remint resistance, or final publication: external trust anchor, signer, public-key distribution, detached-signature format, and offline fail-closed revocation evidence.

## Success Criteria

- [ ] Legacy invocation with no evidence files/context preserves the exact current five-file verification and result behavior.
- [ ] Evidence mode rejects partial inputs; accepts only the exact Hefesto or Optimus context grammar with matching safe IDs; rejects missing, duplicate, unexpected, mismatched, or stale context and invalid time intervals without executing payload code.
- [ ] Receipt v1, producer output, authorization gate, custody runtime boundary, and publication prohibition remain unchanged.
