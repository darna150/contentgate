# ContentGate enterprise-beta acceptance

Status date: July 31, 2026

## Release definition

Enterprise beta is a controlled, allowlisted design-partner release. It is not
public signup, an unrestricted enterprise GA, or a claim of SOC 2, ISO 27001,
privacy, legal, or accessibility certification.

The beta may open only when every **Required** control below has current
evidence against the exact deployed SHA. **Partner-dependent** controls require
either evidence or a written limitation accepted by that design partner.
Deferred controls are enterprise-GA inputs and must not be represented as
present during beta procurement.

## Current evidence map

| Control | Beta requirement | Current evidence | Status |
|---|---|---|---|
| Exact build | Claude UI is integrated once; local, CI, Preview, browser, live-AI, role, recovery, onboarding, log, and security gates all name the same SHA | Claude `c007408` is integrated once; candidate `795c860` passes 353 local contracts and the exact remote verify, clean-migration tenant-isolation, Preview accessibility/E2E, and Vercel gates | In progress — candidate engineering gates pass; live-AI and the remaining operational gates are still open |
| Tenant isolation | Database, Storage, API, and generated outputs deny cross-workspace access | Candidate `795c860` passes the permanent clean-migration two-tenant CI gate; composite tenant foreign keys and Storage/output assertions are included | Pass on candidate SHA |
| Roles | Admin, approver, and member permissions are server-enforced and browser-verified | Candidate `795c860` passes governance contracts and an exact-Preview admin/member lifecycle journey; the journey changed a member to approver, but did not exercise a separate approver browser session | In progress — author/approver representative browser acceptance remains |
| Admin MFA | Every beta workspace administrator uses an MFA-backed session for sensitive administration | Candidate `795c860` proved AAL1 redirect, TOTP enrollment, AAL2 step-up, and sensitive administration on its exact Preview | Pass on candidate SHA; named beta admins still require enrollment |
| Enterprise SSO | One design-partner SAML/OIDC provider is verified, or the partner accepts a written password/MFA beta limitation | No application SSO implementation or partner IdP is selected | Partner-dependent |
| User lifecycle | Invite, role assignment, disable/restore, live-JWT data-access cutoff, Auth re-entry blocking, and access review are auditable | Candidate `795c860` passed exact-Preview role change, disable/restore, stale-JWT cutoff, blocked fresh sign-in, pending-invite cancellation, and matching receipts; teardown left zero disposable organizations, profiles, or Auth users | In progress — real invitation delivery/resend and the first signed access review remain |
| Audit history | Admins can retrieve tenant-scoped events; export is bounded, safe for spreadsheets, and the export itself is recorded | Candidate `795c860` passed exact-Preview tenant-scoped CSV export, `audit.exported` receipt, and a restored non-admin member's `403`; unit contracts prove the 10,000-row bound and spreadsheet-formula shielding | Pass on candidate SHA |
| Data inventory | Stored customer data, subprocessors, regions, and purpose are documented | Machine-checked 29-table/control-plane/Auth/Storage inventory and processor-purpose record exist; exact processor regions, DPAs, and retention require owner approval | Partial — technical inventory complete; procurement inputs open |
| Retention and deletion | Defaults, legal holds, customer export, deletion approval, and deletion receipt are documented and tested | Bounded hashed export, service-only receipts, legal-hold block, dual approval, exact confirmation, supported Storage/Auth deletion, and surviving global evidence passed the disposable staging drill; candidate `795c860` passes the exact remote migration and contract gates | In progress — policy-owner approval pending |
| Backup and recovery | Backup/PITR is configured and a staging restore drill proves the documented RTO/RPO | Pro daily database backup posture and exact Supabase region are documented; recommended RTO/RPO, PITR/Storage requirements, and drill procedure are defined | Missing — purchase/owner approval and timed restore drill required |
| Availability | Health, worker liveness, queue recovery, provider retry, and failure alerts have owners | Health/worker checks, structured logs, a daily authenticated backstop, and bounded authenticated incident webhook are implemented | In progress — five-minute external/plan-backed monitor, production route, named owner, and synthetic delivery proof required |
| Capacity | Concurrent login, upload, Ask, generation, review, and export meet an approved beta envelope | Functional latency and Ask cost evidence exist; load/concurrency envelope is absent | Missing |
| Incident response | Severity model, rollback, communications, evidence preservation, and an exercised tabletop exist | Production release/rollback steps and severity table exist; owners and tabletop evidence are absent | Partial |
| Security | No known P0/P1, no high production dependency vulnerability, advisors reviewed, leaked-password protection enabled, and scoped independent testing has no unresolved critical/high finding | Dependency audit and Supabase advisor review pass without security errors; leaked-password protection and independent testing remain open | Partial |
| Accessibility | Automated WCAG-oriented checks plus keyboard, 200% zoom, reduced-motion, touch-target, announcement, and representative assistive-technology evidence pass | Claude's integrated UI SHA passed the route/viewport sweep and manual keyboard, 200% zoom, reduced-motion, and touch-target checks; candidate `795c860` passes the exact remote accessibility/E2E gate | In progress — representative assistive-technology evidence remains |
| Privacy and customer assurance | Security overview, data flow, retention/deletion, incident contact, DPA/subprocessor inputs, and known beta limitations are reviewable | Technical architecture/runbooks exist; customer-facing assurance pack is absent | Missing |
| Beta operations | Named engineering owner, client-contact owner, go/no-go approver, support hours, escalation path, and design-partner acceptance are recorded | Roles and external pilot acceptance are not yet named | Missing |

## Required beta gates

- [ ] Certify the combined enterprise SHA through the complete remote Preview,
  browser, live-AI, role, recovery, onboarding, log, and security suite.
- [ ] Rerun the passing disposable AAL1/AAL2 administration journey on the final
  release SHA; enroll both named beta-workspace admins before client access.
- [ ] Browser-verify invite, role change, disable/restore, immediate blocked
  data access, Auth re-entry blocking, and receipts on the exact Preview; assign
  the access-review owner and complete the first signed review record.
- [x] Ship and browser-verify tenant-scoped audit export, including export
  receipts and spreadsheet-injection protection.
- [ ] Approve a data inventory and retention/deletion policy; test customer data
  export and guarded workspace deletion on a disposable staging workspace.
- [ ] Set RTO/RPO, perform a staging restore drill, and attach timing/evidence.
- [ ] Establish the beta capacity envelope and pass representative concurrency,
  timeout, retry, and provider-failure scenarios.
- [ ] Route health and error signals to a named incident owner and exercise one
  rollback/communications tabletop.
- [ ] Enable leaked-password protection and close every critical/high finding
  from a scoped independent security assessment.
- [ ] Complete manual accessibility evidence and record any contractual
  limitation without overstating certification.
- [ ] Publish the customer-facing beta security/privacy/operations pack and get
  written design-partner acceptance of beta limitations.

## Partner-dependent identity gate

Before onboarding the first design partner, record its identity provider and
procurement requirement. If SAML/OIDC is required, verify lower-environment and
production configuration, explicit workspace mapping, role assignment,
deprovisioning, and a tested non-SSO break-glass administrator. If the partner
accepts password plus MFA for beta, record the time-bounded exception and keep
SSO as a blocker for that partner's GA.

SCIM, custom roles, multi-region active-active operation, contractual 24/7 SLA,
and completed SOC 2/ISO certification are deferred from the default beta bar
unless a design partner makes one a contractual prerequisite.

## Evidence rule

Green checks from another branch, UI, deployment, environment, or data fixture
do not certify the beta. Every final evidence record must name the release SHA,
Preview or production deployment, environment, test identity/role, timestamp,
result, and evidence owner. Production mutation requires separate explicit
authorization.
