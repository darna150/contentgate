# Lifecycle action model

This contract gives every client-facing content surface one clear primary
action while preserving per-format governance.

## Format lifecycle

| Status | Author primary action | Reviewer primary action | Secondary actions | Export |
| --- | --- | --- | --- | --- |
| No draft | Generate format draft | — | Copy from campaign (explicit only), Original design | Locked |
| Draft | Submit for review | — | Edit message/visual choices, generate refinement, QA draft download if authorized | Locked |
| Changes requested | Address requested changes | — | Read feedback, edit, regenerate, submit again | Locked |
| In review | Await review | Approve | Request changes, inspect change summary/source support/original design | Locked |
| Approved | Export approved format | View approved snapshot | Original design, approved export type/quality | Enabled for the exact approved revision |

## Campaign package rules

- A campaign package is context only; it never supplies a bulk approve,
  request-changes, or export action.
- Formats begin independently. `Copy from campaign` is explicit and remains
  subject to size-specific fit and evidence validation.
- A package’s readiness summary uses each format’s current lifecycle state,
  not a derived campaign-wide approval state.

## Client wording

- Use **Generate draft**, **Submit for review**, **Approve**, **Request
  changes**, and **Export approved format**.
- Explain disabled export directly: “Export unlocks after approval for this
  exact revision.”
- Never label an author action as approval, or a reviewer action as publish.

## Implementation check

The Studio, Content, Product workspace, and Reviews presentation must map
their available primary CTA to this table. Backend role checks, exact-revision
approval, source evidence validation, locked designs, and export controls are
the authority when UI state and server state differ.
