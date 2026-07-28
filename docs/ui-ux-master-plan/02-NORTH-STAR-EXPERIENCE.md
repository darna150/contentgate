# North-star experience

## Experience promise

ContentGate helps a client create compliant campaign assets without needing to understand design software, prompt engineering, or governance infrastructure.

The product should feel:

- Clear: one obvious next action
- Calm: no flashing, blank canvases, or shifting controls
- Fast: immediate acknowledgement and visible continuity
- Trustworthy: source, fit, save, and approval state are inspectable
- Constrained with purpose: rules explain how they protect the brand

## Client mental model

```text
Product
  → Campaign
    → Message
      → Formats
        → Review
          → Approved assets
```

## User roles and primary goals

### Author

- Start from an approved campaign
- Generate or refine grounded copy
- Select approved product/background options
- Verify every required format
- Submit a coherent campaign for review

### Reviewer or approver

- Understand what changed
- Confirm evidence, fit, brand, and compliance
- Approve or request actionable changes
- Avoid editing author controls accidentally

### Administrator

- Prepare products, sources, assets, campaigns, and assignments
- Resolve import, publishing, storage, and render failures
- Monitor client readiness without exposing implementation complexity

## Canonical journey

### 1. Product selection

The product card shows readiness and the next meaningful action. A ready product offers Create campaign content. A blocked product explains the exact missing prerequisite.

### 2. Campaign selection

A campaign card contains:

- Approved campaign thumbnail
- Purpose/description
- Supported format groups
- Product/background choice availability
- Source readiness
- Continue or Start action

### 3. Message creation

Studio starts with a stable original design and a focused message task. Generation is grounded, fit-checked, and recoverable. Visual choices are separate from AI copy actions.

### 4. Multi-format readiness

The user sees which formats are ready, need generation, overflow, failed, or are not required. Formats start independently; authors may explicitly copy from campaign, after which the destination format still receives its own fit, evidence, review, and export checks.

### 5. Review

The reviewer sees a decision summary: changed fields, visual choices, citations, fit, compliance, author, and submission time.

### 6. Export

Approved content exposes clear output dimensions, file type, resolution, and filename. Draft QA exports are explicitly different from approved client assets.

## Information architecture

### Global navigation

Primary:

- Home
- Products
- Reviews
- Content

Library:

- Assets
- Brand knowledge
- Ask

Administration:

- Template Ops
- Team and settings

### Product workspace

- Overview
- Campaigns
- Content
- Reviews
- Assets
- Brand knowledge

### Studio sections

- Message
- Visuals
- Formats
- Review

## Canonical terminology

| Internal/platform term | Client-facing term | Notes |
|---|---|---|
| Template assignment | Campaign | A product's usable design package |
| Template family | Campaign design | Operator-only detail otherwise |
| Template variant | Format | Include channel and dimensions |
| Generated content | Draft | Use asset after approval |
| Source Documents | Brand knowledge / Sources | Brand knowledge is the umbrella |
| Knowledge Hub | Ask Brand Knowledge | Clarifies purpose |
| Product variant | Product color | Use Product option only if not color-specific |
| Background style | Background | Use visual thumbnail |
| Draft preview | Working preview | Not a final asset |
| Reference | Original design | Explains immutability |
| Reject | Request changes | Collaborative lifecycle language |

Do not rename database fields solely for UI terminology. Translate at the presentation boundary.

## State-language system

| Operation | Active label | Success label | Failure label |
|---|---|---|---|
| Field/choice persistence | Saving changes… | Saved | Changes not saved |
| Product/background switch | Updating preview… | Preview updated | Preview could not update |
| AI generation | Generating source-grounded copy… | Draft ready | Copy was not generated |
| Fit check | Checking copy fit… | All fields fit | N fields need shorter copy |
| Reference load | Loading original design… | Original design ready | Original design unavailable |
| Draft download | Preparing QA draft… | Download ready | Draft could not be prepared |
| Approved export | Rendering approved asset… | Download ready | Export could not be rendered |

Each failure must say whether work was preserved and what to do next.

## Interaction principles

### One primary action

Every state has one dominant action. Examples:

- Product blocked: Resolve missing source
- Campaign ready: Open Studio
- New Studio: Generate message
- Edited draft: Save or wait for autosave
- Ready draft: Submit for review
- Reviewer: Approve or Request changes
- Approved: Download approved asset

### Stable geometry

- Buttons do not shift when labels change.
- Preview dimensions remain stable while loading.
- Save state occupies a reserved area.
- Error recovery appears near the failed action without reflowing unrelated controls.

### Immediate acknowledgement

- Selection appears within 100 ms.
- The prior preview stays visible.
- The operation label appears immediately.
- Completion replaces the temporary state without a full-page refresh.

### Progressive disclosure

- Show the current task first.
- Keep selected values visible when sections collapse.
- Put advanced implementation details behind explicit expansion.
- Avoid presenting all 42 formats and nine refinements with equal prominence.

## Visual-system direction

Preserve the current design identity:

- Inter/system sans typography
- Near-monochrome surfaces
- Teal functional accent
- Border-first cards
- Restrained shadows for floating surfaces only
- Status colors used semantically

Refine through consistency, not ornament:

- Standard page header
- Standard spacing scale
- Standard 40/44px control heights
- Minimum readable metadata size
- One loading pattern per operation class
- One save-state component
- One recovery component
- One thumbnail system
- One empty-state structure with a contextual action

Avoid glass effects, decorative gradients, gratuitous animation, or a second accent palette.

## Context-preservation contract

Every deep view should retain:

- Workspace
- Product
- Campaign
- Format
- Draft status
- Return destination

Returning from Studio should restore the prior product tab or content filters and scroll position where feasible.

## Governance communication

Constraints should be explained as benefits:

- Layout locked — matches the approved campaign design
- Copy too long — shorten the message to preserve the approved composition
- Export locked — approval protects the final client asset
- Proof point unavailable — no approved source currently supports an additional claim

Never hide or weaken the rule to make the interface appear simpler.
