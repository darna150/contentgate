# ContentGate Knowledge Hub Contract

Last updated: 2026-07-13

## Purpose

The Knowledge Hub answers product questions from approved organization knowledge. It is an evidence interface, not a general chatbot.

## Source Eligibility

- A user must be authenticated and the requested product must be active and visible through organization RLS.
- Only admin-controlled `documents` rows explicitly assigned to that product are eligible for AI retrieval.
- A document with `product_id = null` is treated as org-wide evidence: `search_product_knowledge` includes it for any product query in that organization. This is intentional — admins use null-product docs for shared brand knowledge that applies across all products.
- Cross-organization and inactive-product retrieval must return no rows.

## Retrieval

- `search_product_knowledge` performs organization-safe Postgres full-text search over numbered document paragraphs.
- Retrieval returns at most 20 rows and the application currently requests 12.
- Each evidence unit has a stable `(document_id, paragraph_n)` identity.
- Embeddings are intentionally deferred until measured full-text retrieval quality shows a real need.

## Answer And Citation Rules

- The model receives only the retrieved paragraph set, not every organization document.
- Every supported answer must return at least one citation from that exact set.
- Each citation must identify the exact `document_id`, `paragraph_n`, and a verbatim excerpt contained in that paragraph.
- The server validates citation identity and excerpt containment. Model-supplied document titles are not trusted.
- If no evidence is retrieved, a citation is invalid, or an answer claims support without a verified citation, return the safe no-evidence response.

## Session Rules

- Notebook sessions belong to one authenticated user, organization, and active product.
- RLS enforces ownership on read, insert, update, and delete and prevents product or organization reassignment.
- The server limits session size and reports failed saves to the user instead of silently losing the conversation.
- Historical citations without paragraph numbers may still open by document and excerpt; all new citations use stable paragraph identity.

## Future Work

- Add a small retrieval-quality fixture set and measure recall before considering embeddings.
- Add source approval lifecycle metadata only when draft documents become an actual product requirement. In the current MVP, document writes are admin-only and product assignment is the approval boundary.
- Claude Code may polish source inspection and mobile behavior, but must preserve this retrieval, citation, RLS, and no-evidence contract.
