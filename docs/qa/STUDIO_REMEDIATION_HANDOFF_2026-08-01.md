# Studio remediation handoff — start a new session here

## Objective

Take ContentGate Studio from the audited no-go state to a pilot-ready release without weakening evidence grounding, template fit, approval gating, or export authorization.

## Source of truth

- Repository: `/private/tmp/contentgate-enterprise-release.uOsm0M/repo`
- Branch at audit: `codex/complete-build-source-of-truth`
- Audited commit: `2f11c6b575536fc323e742b66d2a916594153b6d`
- Audit report: `docs/qa/STUDIO_PILOT_EXHAUSTIVE_AUDIT_2026-08-01.md`
- Audit harness: `tests/e2e/studio-pilot-exhaustive-audit.spec.ts`
- Evidence: `/private/tmp/contentgate-studio-audit-2026-08-01/evidence`

Baseline generation is healthy on this frozen candidate: the guarded 42-format matrix passed 42/42 fresh first requests with zero conservative fallbacks. Keep that distinct from refinement generation, where 7/9 visible semantic directions failed.

Before editing, confirm the current branch contains the audited commit and review any commits made after it. Do not test against production.

## Fix order

### Workstream 1 — refinement reliability (pilot blocker)

Owner: generation/backend engineer.

Fix `CG-STUDIO-P1-001` first. The current first-request result is 2/9 success:

- Pass: Shorter, Longer
- Fail 422 `generation_variation_exhausted`: More strategic, More playful, More urgent, Simpler, On-brand voice, Add proof point, Lead with benefit

Investigate the semantic verifier, retry/repair loop, variation checks, and deterministic fallbacks together. Do not simply relax the verifier. A candidate must still be grounded, meaningfully different, and fit-safe.

Required design decision: if approved Nimbus evidence cannot support a direction such as Add proof point, disable that control before the user submits it and explain why.

Primary code areas:

- `src/app/api/products/generate/route.ts`
- `src/lib/revision-contract.ts`
- `src/lib/templates.ts`
- generation/revision tests

Exit gate: 9 directions × 5 independent baselines, at least 95% first-request usable results for available controls, zero grounding or fit regressions.

### Workstream 2 — autosave state machine and concurrency (pilot blocker)

Owner: senior full-stack engineer.

Fix `CG-STUDIO-P1-002`, `003`, and `004` as one state-machine problem:

- every edit receives a monotonic client sequence;
- obsolete fit/save requests may abort but cannot own final UI state;
- the latest valid edit always reaches one terminal state: saved or persistent error;
- stale `updated_at`/version writes are rejected and surfaced as conflicts;
- offline/network failures retain recoverable text and block unsafe navigation;
- Fit `measuring…` cannot remain indefinitely after input stabilizes.
- an older asynchronous autosave can never persist after a newer local edit; the audit reproduced an old emoji probe replacing the restored `RUN ON AIR` headline on reload.

Primary code areas:

- `src/app/(app)/studio/studio-workspace.tsx`
- `src/app/(app)/content/actions.ts`
- `src/lib/studio-state.ts`
- generated-content optimistic locking/RLS/RPC boundary

Exit gates:

1. two-tab stale write cannot silently win;
2. offline edit shows persistent unsaved state within 10 seconds;
3. rapid adversarial input resolves to the latest value and one final fit result;
4. Copy unsaved fields and Reload latest are keyboard accessible and preserve text.

### Workstream 3 — selected-state accessibility

Owner: frontend/accessibility engineer.

Fix `CG-STUDIO-P1-005` by making the product variants a real single-selection control. Prefer a radiogroup consistent with the background picker, including roving focus and arrow-key selection.

Exit gate: exactly one variant is announced as selected before and after reload; axe remains clean; keyboard-only operation passes.

### Workstream 4 — preview stability and touch polish

Owner: UI/UX engineer after P1 files settle.

- Avoid enabling asset pickers before the authoritative text layout settles, or present a clear loading state.
- Raise important compact/mobile controls toward 44×44 and verify WCAG 2.2 minimum target size/spacing.
- Preserve the current Fit contract: complete artwork, no stage scroll.

## Mandatory retest sequence

1. Unit/type gates:
   - `npx tsc --noEmit`
   - `npm run test:ui`
   - targeted generation/revision/fit tests
2. Run `tests/e2e/studio-pilot-exhaustive-audit.spec.ts` on a new staging Preview.
3. Run the guarded 42-format generation matrix with zero fallback.
4. Run the guarded provider-failure test.
5. Run WebKit and Firefox Studio smoke/lifecycle checks.
6. Perform manual VoiceOver review of variant/background selection, refinement errors, autosave conflict, rejection, and export.
7. Freeze a new commit and issue a new go/no-go report; do not reuse this report's pass status for changed code.

## Copy/paste prompt for the new Codex session

```text
You are the release remediation lead for ContentGate Studio. Work from /private/tmp/contentgate-enterprise-release.uOsm0M/repo and read docs/qa/STUDIO_PILOT_EXHAUSTIVE_AUDIT_2026-08-01.md plus docs/qa/STUDIO_REMEDIATION_HANDOFF_2026-08-01.md completely before editing. The audited source was codex/complete-build-source-of-truth at 2f11c6b575536fc323e742b66d2a916594153b6d. Production is out of scope; use only the guarded staging Preview and disposable fixtures.

Implement the P1 workstreams in order: (1) 7/9 semantic refinement first-request failures, (2) stale-tab/offline/rapid-edit autosave state integrity, and (3) product-variant selected-state accessibility. Preserve grounding, fit checks, approval gating, export authorization, 42-format Fit behavior, and the passing lifecycle/export/provider-failure gates. Do not hide failures by weakening validators. Add deterministic regressions, deploy a fresh Preview, rerun the exhaustive Studio harness, 42-format generation matrix, provider-failure gate, WebKit/Firefox smoke, and manual screen-reader checklist. Return a new evidence-backed go/no-go report.
```
