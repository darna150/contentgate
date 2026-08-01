# ContentGate enterprise-beta access review

Status date: July 31, 2026

## Cadence and ownership

During enterprise beta, each workspace access list is reviewed monthly and
within one business day of a reported departure, role change, lost device, or
suspected credential compromise. Before opening a beta workspace, record one
named review owner and one named approver in its launch record. The owner cannot
approve their own unexplained administrator access.

## Review procedure

1. Record the workspace name and ID, review date, reviewer, approver, exact
   deployed SHA, environment, and next due date.
2. Export the tenant-scoped audit history for the period since the previous
   review and preserve the export receipt ID.
3. From Settings, compare every active, invited, and disabled identity with the
   design partner's approved roster. Confirm role, business owner, and continued
   need. Treat unaccepted invitations as access that still needs a decision.
4. Verify there are at least two active administrators and that every admin has
   an enrolled MFA factor and a documented recovery contact.
5. Disable unexpected or departed identities; cancel stale invitations using
   the same control; correct excess roles. Do not delete profiles that own
   governed records.
6. Confirm each change appears in the audit export as `member_role_changed`,
   `member_disabled`, or `member_restored`. Escalate any missing receipt as a
   release-blocking control failure.
7. Have the named approver sign off the final roster and all accepted
   exceptions. Store the evidence in the workspace's controlled beta evidence
   location.

## Evidence record

Copy this block into the beta launch record for each review:

```text
Workspace / organization ID:
Environment:
Exact deployed SHA:
Review period:
Reviewer:
Approver:
Audit export receipt ID:
Active admins (count and IDs):
Active approvers (count and IDs):
Active members (count and IDs):
Pending invitations (count and IDs):
Disabled identities (count and IDs):
Changes made (audit event IDs):
Accepted exceptions and expiry:
Result: PASS / BLOCKED
Completed at (UTC):
Next review due (UTC):
```

An empty template is procedure, not evidence. Enterprise beta remains blocked
until the first design-partner workspace has a completed, approved record.
