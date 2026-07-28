# Internal pilot runbook

## Purpose

Validate the redesigned campaign and review workflow with the authorized
five-person demo cohort before a broader rollout.

## Cohort

| Role | Participants | Focus |
| --- | ---: | --- |
| Author | 2 | Create independent formats, optionally copy from campaign, submit for review. |
| Reviewer | 2 | Inspect campaign package context, use feedback categories, approve or request changes per format. |
| Administrator | 1 | Verify source readiness, access boundaries, and the end-to-end lifecycle. |

Credentials are not recorded in this repository. Reset or distribute them
through the approved secure channel only.

## Session protocol

1. Use the Nimbus demo workspace and a current browser at desktop or mobile width.
2. Run the five scenarios in [05-RESEARCH-ACCESSIBILITY-QA.md](05-RESEARCH-ACCESSIBILITY-QA.md).
3. Do not explain implementation concepts such as templates, variants, or assignments.
4. Record completion, time, confidence, errors, and observed wording confusion.
5. Capture only non-sensitive screenshots; never record source text, tokens, or signed URLs.

## Success thresholds

- At least 4 of 5 participants complete their role-relevant core task without facilitator intervention.
- Every participant can explain why a format is not exportable when it is not approved.
- Every reviewer understands that a campaign package provides context but does not approve multiple formats.
- No governance, evidence, locked-design, or export lifecycle defect is observed.

## Stop conditions

Pause the rollout and create a decision-log entry if any participant encounters:

- an export before approval;
- unsupported or inactive-source content presented as valid;
- a format switch that changes another format without an explicit copy action;
- a locked-design mismatch;
- an unrecoverable save, preview, or review state.

## Handoff

Summarize findings by scenario and role. Update the execution roadmap with
completed validation, unresolved risks, and any release-blocking issues before
enabling a broader audience.
