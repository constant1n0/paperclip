# Design: Authorize Private Diagnostics Artifact

## Technical Approach

Add an authorization-evidence module beside immutable receipt v1 and extend the static verifier with two modes. Legacy mode retains the existing five-file verification and result when no evidence file or evidence-context argument is present. Evidence mode snapshots two additional files and validates closed canonical bytes, exact expected context, a single-clock validity interval, declarative storage strings, and cross-binding. Nothing signs, fetches, executes archive content, mutates Placa B, validates custody evidence, or reports authenticated human case approval/current revocation.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Two verifier modes | Unconditional seven-file discovery | Preserves the current five-file caller contract and result exactly; partial opt-in inputs fail closed. |
| Separate authorization-evidence v1 manifest | Extend receipt v1; treat custody as human approval | Receipt null slots stay immutable; custody cannot prove owner intent. |
| Explicit audience/case/incident inputs | Ambient identity; audience-only input | Exact context stops same-audience cross-case replay and makes break-glass incident-scoped. |
| One captured verification clock | Multiple `Date.now()` calls | Gives one unambiguous interval decision: `issuedAt <= verificationTime < expiresAt`. |
| Declarative storage strings; independent inspection directory | Require Placa B locator to resolve or equal inspection directory | Keeps the legacy snapshot byte-for-byte/behaviorally unchanged while evidence mode adds an isolated hardened snapshot/recheck path for independently secured copies. |
| `authorizationEvidence: "unsigned"` result | `authorization`/`authorized` terminology | Keeps unsigned structural evidence distinct from HUMAN-OPS human case approval. |

## Data Flow

```text
CLI args + authorization-file presence
  -> legacy mode: existing five-file snapshot -> existing static inspection -> unchanged result
   -> evidence mode: require both files + full expected context
        -> snapshot clock once -> hardened snapshots for every inspected file in --artifact-dir
       -> closed/canonical validation -> exact context/time/storage-string binding
        -> static archive inspection -> hardened descriptor/path recheck
       -> unsigned structural-evidence result with caseId/incidentId
```

Legacy mode is selected only when neither `<artifact-id>.authorization.json` nor its sidecar is present and no `--audience`, `--case-id`, or `--incident-id` is supplied. It accepts exactly the current CLI grammar: `--artifact-dir ABSOLUTE_DIR --receipt SAFE_RECEIPT_BASENAME`, in its current order, and returns the current result unchanged. Its existing `snapshot()` implementation and five-file call sequence remain byte-for-byte and behaviorally unchanged; this change does not backport evidence hardening into legacy mode. Any evidence file or context argument selects evidence mode; missing, duplicate, unknown, or incomplete evidence-mode inputs and `--require-authorized` fail.

Evidence-mode grammar adds `--audience hefesto|optimus --case-id CASE_ID` and conditionally `--incident-id INCIDENT_ID`: Hefesto requires no incident argument and manifest `incidentId: null`; Optimus requires a nonempty incident argument distinct from case ID and exact matches for both values. `verifyArtifact(argv, { clock?: () => number, ...testSeams })` invokes the clock exactly once after evidence mode is selected and supplies that instant throughout policy validation.

## Interfaces / Contracts

`scripts/private-local-diagnostics-authorization-lib.mjs` exports `CUSTODY_ROOT`, `validateAuthorizationEvidence(value)`, `validateAuthorizationPolicy(value, expectedContext, verificationTime)`, `crossBindAuthorization(value, bindings)`, `formatAuthorizationSidecar`, and `parseAuthorizationSidecar`. It exposes no signer, human-approval creator, or custody-record validator.

Authorization JSON is closed: top-level `schemaVersion`, `artifactId`, `receipt`, `verification`, `artifact`, `storage`, `grant`, `revocation`, `signature`; receipt/verification `{filename,sha256}`; artifact `{filename,sha256,bytes}`; storage `{custodyRoot,locator}`; grant `{ownerAuthorizationRef,caseId,incidentId,audience:{principal,mode},issuedAt,expiresAt}`; revocation `{status,reference}`. Version is `1`; hashes are lowercase SHA-256; bytes are positive safe integers; signature is null; status is `unverified`; UTC RFC3339 times satisfy `issuedAt < expiresAt`. `storage.custodyRoot` is exactly `CUSTODY_ROOT`, and `storage.locator` is exactly `${CUSTODY_ROOT}/${artifactId}` as a canonical declarative string—never a resolved host path. Sidecar: `<sha256>  <artifactId>.authorization.json\n`.

```ts
const AUTHORIZATION_EVIDENCE_STATE = { UNSIGNED: "unsigned" } as const;

interface StructuralAuthorizationEvidenceResult {
  authorizationEvidence: (typeof AUTHORIZATION_EVIDENCE_STATE)[keyof typeof AUTHORIZATION_EVIDENCE_STATE];
  authorizationEvidenceSha256: string;
  revocation: "unverified";
  audience: "hefesto" | "optimus";
  mode: "normal" | "break-glass";
  caseId: string;
  incidentId: string | null;
}
```

The evidence-mode result extends only the evidence path; it never satisfies human case approval. Custody controls and custody-evidence records are documentation-only/HUMAN-OPS and deliberately have no parser, result field, runtime acceptance, validation, or enforcement in this change.

## Files and Safety

| File | Action | Boundary |
|---|---|---|
| `scripts/private-local-diagnostics-artifact-lib.mjs` | Modify | Export reusable canonical/sidecar validators; receipt v1 unchanged. |
| `scripts/private-local-diagnostics-authorization-lib.mjs` | Create | Pure closed evidence contract, expected-context policy, and cross-binding. |
| `scripts/private-local-diagnostics-verification-lib.mjs` | Modify | Preserve legacy parser/path; select evidence mode, snapshot safely, and return unsigned evidence. |
| `scripts/verify-private-local-diagnostics-artifact.mjs`, `package.json` | Modify | Preserve wrapper; expose evidence grammar and document CLI/result terminology in this slice. |
| `scripts/*diagnostics*artifact*.test.mjs` | Modify/create | Legacy regression, contract, replay, interval, path, and no-execution coverage. |

`--artifact-dir` remains a caller-supplied real absolute inspection directory, never derived from `storage.locator`. Derive evidence basenames from validated `artifactId`, never manifest paths. Evidence mode alone uses a new isolated hardened snapshot/recheck helper for every inspected file (the five legacy files plus the authorization manifest and sidecar): `lstat` requires regular/non-symlink/`nlink===1`; `open(O_RDONLY|O_NOFOLLOW)`; match pre-open `lstat` to `fstat` (`dev/ino`); retain descriptors through bounded reads and static inspection; then compare descriptor and final-path `dev`, `ino`, `size`, `nlink`, and timestamps to reject mutation or replacement before close. The helper receives an injected filesystem/clock seam only in tests so mutation/replacement proofs are deterministic. Legacy mode continues to call its existing `snapshot()` unchanged. Apply no host filesystem operation to `storage.custodyRoot` or `storage.locator`.

## Testing and Threat Mapping

| Threat/requirement | Focused proof |
|---|---|
| Legacy compatibility | Current two-argument five-file invocation has the exact current result; no evidence files/context. |
| Mode fail-closed | Each single/missing authorization file and each incomplete/context-only combination rejects. |
| Closed/context contract | Unknown/missing/prototype fields, malformed UTC/hash/bytes, sidecar deviations, Hefesto incident, Optimus missing/equal incident, wrong case/incident. |
| Time/replay | Future-issued, expired, boundary-valid, wrong audience/mode, and same-audience cross-case replay reject as required. |
| Inspection/storage separation | Arbitrary protected absolute copy succeeds; unsafe inspection input and noncanonical declarative storage strings reject; locator is never resolved. |
| TOCTOU/path/link | Evidence mode deterministically proves escape/backslash, symlink, hardlink, FIFO, inode replacement and mutation-during-read rejection through the isolated hardened helper; legacy coverage proves its unchanged behavior. |
| Overclaim/execution | Exact `authorizationEvidence: "unsigned"` result; rejected `--require-authorized`; malicious archive sentinel remains absent. |
| Regression | Receipt null slots and trusted producer smoke/exact five-file output remain unchanged. |

## Stacked-to-Main Work Units

| Unit (budget) | Start -> Finish | Verification | Rollback |
|---|---|---|---|
| 1 Contract (<=350) | Existing v1 helpers -> shared byte-stable helpers plus isolated evidence parser | Contract/unit tests | Revert new module/helper exports. |
| 2 Verifier + CLI/result docs (<=400) | Unit 1 merged -> unchanged legacy mode plus fail-closed evidence mode and terminology documentation | Focused adversarial/no-execution tests | Revert verifier wiring and its documentation together; five-file verifier survives. |
| 3 Boundary regression (<=300) | Unit 2 merged -> legacy/producer regression and no runtime custody-evidence behavior | Focused scripts tests | Revert boundary regression additions. |

Each retained branch targets `main` after its predecessor merges; each merge requires owner authorization. No size exception.

## Migration / Rollout and Future Gate

No migration or runtime rollout. The operator manual is not changed in this design-fix round. Before any future signer, human-approval result, `--require-authorized` success, final artifact, or publication, the owner must separately approve signer/key lifecycle, public trust-anchor distribution, detached-signature format, and offline fail-closed revocation evidence.

## Open Questions

None; signer/revocation choices and any custody automation are deferred to the future owner gate.
