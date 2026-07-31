# Correction: commit `0286650` is onboarding work, not authentication work

Commit `0286650` on `claude/enterprise-ui-pilot` is titled:

> `ui: improve operator onboarding and authentication`

**It contains no authentication changes.** It touches exactly two files, both
onboarding:

```
src/app/(app)/onboarding/environment-banner.tsx   (new)
src/app/(app)/onboarding/onboarding-workflow.tsx
```

The title was taken from the prescribed commit sequence in the implementation
brief and left in place on a commit that only earned the first half of it. No
file under `src/app/login/`, `src/app/forgot-password/`,
`src/app/reset-password/`, `src/app/welcome/` or `src/app/auth/` was modified by
it.

Anyone auditing the branch by commit subject would wrongly conclude the
authentication surfaces had been reviewed at that point. They had not.

## Where the authentication work actually is

Authentication was reviewed and fixed later, in commit `1dce7e4`
(`ui: close authentication defects on the sign-in and recovery path`), which
covers the expired/reused link dead end, enumeration-safe sign-in errors, the
network-failure lockout on both forms, and autofill pairing.

## Why this is a correction note and not a rewrite

`0286650` is already published on draft PR #59. Rewriting it would require a
force-push, which is out of scope for this branch. The commit stands as it is
and this note is the record.

Recorded 2026-07-31.
