# Enterprise identity and lifecycle staging evidence

Evidence time: 2026-07-31T13:44:26Z  
Application SHA: `6d93f358b21f1c597cb943512e6a3bc3dd61e714`  
Preview: `https://contentgate-rh2dp2fql-debbies-projects-a8de6bb4.vercel.app`  
Database: staging `bncwjibscptgijgmuhrn`  
Schema migrations: `20260731132045`, `20260731132952`, `20260731134218`  
Evidence owner: Codex engineering task

## Guarded journey

The opt-in Playwright gate in `tests/e2e/enterprise-lifecycle.spec.ts` created a
unique disposable workspace whose administrator MFA requirement defaulted to
enabled. It then proved, against the exact Preview above:

- the new administrator's AAL1 login was redirected to `/mfa`;
- TOTP enrollment and challenge raised the session to AAL2;
- an AAL2 admin changed a member from `member` to `approver`;
- the role change created `member_role_changed` in the tenant audit history;
- disabling the member created `member_disabled`;
- the member's access token issued before disablement immediately resolved no
  organization and could read no profile rows;
- a fresh password sign-in for the banned member was rejected;
- restoring the member created `member_restored` and allowed sign-in again;
- `/api/audit/export` returned a CSV containing the lifecycle receipts and
  created `audit.exported`;
- test teardown deleted the disposable Auth users and workspace.

Result: **1 passed in 47.2 seconds**.

Post-run database queries returned zero matching disposable enterprise profiles
and zero matching disposable enterprise organizations. Production was not read
or mutated by this journey.

## Defect found and closed during the gate

The first complete run found that the 2026-07-06 profile membership trigger
also rejected the validated AAL2 role-change RPC. Migration `20260731134218`
preserves the direct authenticated-update denial while permitting the
database-owner execution context of the validated lifecycle RPC. A rollback-only
SQL test then proved the real role mutation and receipt, and the complete browser
journey passed after the correction.

This evidence closes implementation and staging-runtime risk for the tested
path. The final enterprise release SHA must rerun the gate, and the first design
partner still needs a named human access-review owner and signed review record.
