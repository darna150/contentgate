# ContentGate UI/UX Master Plan

Status: active internal pilot with authenticated browser verification complete.

Implementation status: Phase 0 baseline/decision work and selected delivery
work across Phases 1–7 are in progress as of 2026-07-28. See the
[execution roadmap](./04-EXECUTION-ROADMAP.md),
[baseline evidence](./07-PHASE-0-BASELINE.md), [decision log](./08-DECISION-LOG.md),
and [pilot runbook](./09-PILOT-RUNBOOK.md).

This package turns the July 2026 UI/UX audit into an execution-ready design and engineering handoff. Start here, then read the documents in order.

## Reading order

1. [New-session handoff](./00-NEW-SESSION-HANDOFF.md)
2. [Audit findings](./01-AUDIT-FINDINGS.md)
3. [North-star experience](./02-NORTH-STAR-EXPERIENCE.md)
4. [Studio redesign specification](./03-STUDIO-REDESIGN-SPEC.md)
5. [Execution roadmap](./04-EXECUTION-ROADMAP.md)
6. [Research, accessibility, and QA plan](./05-RESEARCH-ACCESSIBILITY-QA.md)
7. [Measurement plan](./06-MEASUREMENT-PLAN.md)
8. [Baseline evidence](./07-PHASE-0-BASELINE.md)
9. [Decision log](./08-DECISION-LOG.md)
10. [Pilot runbook](./09-PILOT-RUNBOOK.md)
11. [External validation and rollout gates](./10-EXTERNAL-VALIDATION-GATES.md)
12. [Lifecycle action model](./11-LIFECYCLE-ACTION-MODEL.md)
13. [Operation copy contract](./12-OPERATION-COPY-CONTRACT.md)

## Purpose

The objective is to make ContentGate feel fast, calm, trustworthy, and obvious to a first-time client while preserving the product's governance guarantees:

- Figma remains the source of truth for layout and visual design.
- Generation changes approved copy fields only.
- Product art, backgrounds, typography, scale, crop, and coordinates remain locked except through explicit approved asset choices.
- Overflow is solved through copy, never by silently changing the design.
- Unsupported factual claims fail closed.
- Export remains gated by lifecycle and permission rules.

## North-star journey

The client-facing mental model should contain only five concepts:

1. Choose a product.
2. Choose a campaign.
3. Create or refine the message.
4. Submit it for review.
5. Download approved outputs.

Template versions, assignments, manifests, storage paths, render jobs, evidence validation, and size-specific variants remain available to operators but should not burden ordinary users.

## Scope

The audit covers:

- Global navigation and workspace context
- Dashboard and product workspaces
- Content ledger and approvals
- Studio authoring, refinement, preview, review, and export
- Assets and transparent-product governance
- Brand knowledge, sources, citations, and Ask
- Template Ops separation
- Responsive behavior
- Accessibility
- Perceived performance
- Error recovery and trust
- Product analytics and usability research

## Non-goals

- Replacing the current visual identity
- Redesigning locked Nimbus campaign artwork
- Changing backend governance rules to make UI work easier
- Introducing decorative visual effects without a usability purpose
- Upgrading frameworks or paid infrastructure as part of UI work

## Source material

- Existing design specification: [design README](../design/README.md)
- Existing browser QA guide: [E2E QA](../e2e-qa.md)
- Template platform contract: [template platform](../template-platform-v1.md)
- Current UI screenshots: `docs/design/screenshots/`

## Definition of success

The redesign succeeds when a new client can complete the core journey without explanation, always knows whether work is saved, understands why an action is unavailable, and can distinguish generation, preview updates, review, and export without learning internal platform architecture.
