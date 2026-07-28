# Measurement plan

## Principle

Measure user understanding and completion, not only server latency. A fast operation that looks stalled still feels slow; a transparent staged operation can feel trustworthy even when it takes longer.

## Baseline before redesign

Capture the following before any material UI change:

- Median and p95 time from opening a campaign to visible working preview
- Median and p95 time from picker selection to preview update
- Median and p95 draft autosave duration
- Median and p95 generation duration
- Generation failure and retry rate
- Preview-unavailable rate
- Optimistic-lock conflict rate
- Draft-submit completion rate
- Approval completion time
- Request-changes rate and reason mix
- Approved export completion/failure rate
- Abandoned Studio sessions
- Support or clarification requests per workflow
- Usability-task completion, time, confidence, and error count

## Event taxonomy

Use product-safe events. Do not emit copy content, source text, signed URLs, or sensitive document details.

| Event | Required properties |
|---|---|
| `studio_opened` | product_id, campaign_id, format_key, role, entry_surface |
| `studio_preview_ready` | format_key, duration_ms, mode, asset_count |
| `studio_picker_selected` | picker_type, option_key, format_key |
| `studio_picker_saved` | picker_type, duration_ms, outcome |
| `studio_save_completed` | duration_ms, outcome, conflict_reason? |
| `studio_generation_started` | direction?, format_key, source_count |
| `studio_generation_completed` | duration_ms, outcome, fit_state, evidence_count |
| `studio_generation_failed` | duration_ms, safe_reason_code |
| `studio_format_selected` | from_format, to_format, source_of_change |
| `studio_review_submitted` | format_key or campaign_id |
| `review_decision` | decision, duration_ms, change_reason? |
| `export_started` | type, format_key, file_format, quality |
| `export_completed` | type, duration_ms, outcome |
| `preview_error` | safe_reason_code, format_key |

## Experience budgets

These are targets, not promises. Measure and tune against real deployment behavior.

| Interaction | Immediate response | Preferred completion | Escalation threshold |
|---|---:|---:|---:|
| Control press/selection feedback | <100 ms | n/a | >250 ms |
| Local visual selection persistence | <100 ms | <1.5 s | >3 s |
| Preview asset/font ready | prior preview retained | <2 s | >4 s |
| Draft autosave | state shown immediately | <1.5 s | >3 s |
| Draft generation | stage shown immediately | <8 s | >15 s |
| Format switch | reference or prior preview retained | <2 s | >4 s |
| Draft QA download preparation | state shown immediately | <5 s | >10 s |
| Approved export | state shown immediately | <8 s | >15 s |

When a threshold is exceeded, do not merely add a spinner. Diagnose whether it is data loading, signed asset signing, font loading, image rendering, generation provider latency, storage, or client orchestration.

## Outcome metrics

### Comprehension

- Percentage of users who can explain why export is unavailable
- Percentage who distinguish Working preview from Original design
- Percentage who can locate source support without help
- Percentage who identify whether a format is ready

### Efficiency

- Time to first useful draft
- Time to complete three-format campaign
- Review time per draft
- Number of navigation reversals per task
- Number of repeated picker attempts per selection

### Trust

- Confidence rating that output is brand-safe
- Confidence rating that claims are supported
- Rate of manual reviewer verification of citations
- Rate of unexpected export/download complaints

### Reliability

- Save conflict rate
- Preview error rate
- Broken asset rate
- Export mismatch report rate
- Generation retry rate

## Experiment discipline

- Do not A/B test governance rules or evidence enforcement.
- Use feature flags for workflow presentation changes.
- Compare user outcome metrics, not click volume alone.
- Segment by role, product count, format count, and device class.
- Review qualitative feedback alongside telemetry.
- Define stop conditions for regressions: rising save conflicts, preview failures, approval delays, or export errors.

## Dashboard recommendations

Build an internal UI/UX health dashboard with:

- Core funnel: Product → Campaign → Draft → Review → Approved export
- p50/p95 duration trends
- Error/retry reasons
- Device and browser segmentation
- Format-specific preview/fit problems
- Source/evidence rejection rate
- Top user-feedback themes

Do not expose this operational dashboard to ordinary clients.

## Current validation snapshot — 2026-07-28

The Nimbus pilot flag is enabled and the deployed privacy-safe event writer is
receiving events. The current validation window contains 61 safe events,
including 25 `studio_opened`, 9 `studio_format_selected`, 6
`studio_generation_started`, 5 `studio_generation_completed`, 2
`studio_save_completed`, 12 picker selections, 1 generation failure, and 1
review decision. The five successful generation events have a 7,961 ms median
and a 15,557 ms p95; the two save events have a 2,424 ms median and a 2,816 ms
p95.

This proves the authenticated collection path, event allowlist, and initial
technical timing baseline. It is not sufficient to calculate human task
completion, confidence, or a true baseline/post-change comparison. Keep that
gate open until the five pilot session records and a post-change observation
window are available.
