# Operation copy contract

Use these client-facing states consistently across Studio and review surfaces.

| Situation | Required copy | Recovery |
| --- | --- | --- |
| Local change pending | Unsaved changes | Keep editing or wait for autosave. |
| Autosave active | Saving… | Keep the prior preview visible. |
| Autosave completed | Draft saved | Show the saved time when available. |
| Autosave conflict/error | Save failed | Explain whether the server draft changed and offer refresh/retry; never discard local fields silently. |
| Generation started | Writing source-grounded copy… | Disable duplicate generation only. |
| Fit validation | Checking copy fit… | Identify the specific field when copy does not fit. |
| Preview build | Building preview… | Retain the previous preview or Original design. |
| Preview failure | Preview unavailable | Provide Refresh Studio; preserve the draft and its save state. |
| Review pending | Submitted for review. Editing is paused until it is approved or returned. | Link back to the package/queue context. |
| Export locked | Export unlocks after approval for this exact revision. | Explain the review action needed. |

## Rules

- Use a short live announcement for operation progress and errors.
- Do not replace a working preview with a blank state during an update.
- Do not use generic “Something went wrong” when a safe, actionable reason is
  known.
- Preserve server-enforced wording when it explains evidence, fit, lifecycle,
  or permission restrictions.
