# ContentGate enterprise-beta identity and access

Status date: July 31, 2026

## Beta identity model

ContentGate enterprise beta uses invited Supabase Auth users and three fixed
workspace roles:

- `member`: creates and edits governed drafts;
- `approver`: reviews and approves without receiving administration rights;
- `admin`: manages members, products, knowledge, assets, templates, and other
  protected workspace configuration.

Public signup is not part of the beta. Organization membership and role are
staged server-side before an Auth invite is sent; browser-controlled metadata
cannot assign either value.

## Administrator MFA

Migration `20260731132045_enterprise_admin_mfa.sql` adds the workspace setting
`require_admin_mfa` and makes it default to `true` for newly created
organizations. Existing organizations receive `false` once so their current
admins are not locked out before enrollment.

An existing workspace is enabled in this order:

1. An administrator signs in and opens `/mfa`.
2. The administrator enrolls and verifies a TOTP authenticator.
3. From Settings, that AAL2 session calls the atomic
   `enable_admin_mfa_requirement()` RPC.
4. The RPC enables the workspace requirement and writes the
   `admin_mfa_required` audit event in the same transaction.
5. Later AAL1 administrator sessions are redirected to `/mfa` before the app
   shell renders.

Enforcement is not UI-only. When the workspace requirement is active,
`auth_role()` maps an AAL1 administrator to member capability for RLS. The app
shell, service-role-backed admin APIs, knowledge administration, member invites,
and cross-tenant platform onboarding independently verify AAL2. Platform
onboarding requires AAL2 even before the operator's workspace opts in.

## Recovery and break glass

The beta UI does not allow an administrator to disable workspace MFA or remove
their last verified factor. Recovery is an operator-controlled process:

1. Verify the requester using the design partner's named security contact and
   recorded escalation channel.
2. Preserve the request and approval in the incident record.
3. A named Supabase project owner removes the inaccessible factor using the
   Auth administration surface.
4. The administrator signs in, enrolls a replacement factor, and verifies AAL2.
5. Record the restored user ID, factor reset time, operator, approver, and
   incident reference in the workspace audit/incident record.

Each beta workspace should have two administrators before client go-live so a
lost device does not depend on a single user. This is an operating acceptance
criterion until a dedicated factor-recovery workflow is implemented.

## Partner-dependent SSO

SAML/OIDC is not a default enterprise-beta prerequisite. Before onboarding,
record whether the design partner accepts invited password plus mandatory admin
MFA. If its contract requires SSO, that partner remains blocked until its IdP,
workspace mapping, role assignment, deprovisioning, and non-SSO break-glass
account are tested in a non-production environment and then configured under a
separate production change approval.

## Still required for lifecycle closure

- auditable role changes;
- disable/removal with session revocation;
- pending-invite cancellation and resend controls;
- a documented periodic access review with named owner and evidence;
- browser evidence for admin, approver, and member after the final migration.

No production identity or database configuration is changed by this document
or by the enterprise-beta branch.
