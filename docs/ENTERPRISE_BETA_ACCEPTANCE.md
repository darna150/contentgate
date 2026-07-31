# ContentGate enterprise-beta acceptance

Status date: August 1, 2026

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
| Exact build | Claude UI is integrated once; local, CI, Preview, browser, live-AI, role, recovery, onboarding, log, and security gates all name the same SHA | Claude `c007408` is integrated once. Application SHA `602edbd` passed the exact Preview provider-failure and stateful happy-path regressions plus the full remote gate set. SHA `606626d` changes only the CodeQL workflow; its CodeQL, verify, 93-migration tenant-isolation, Preview accessibility/E2E, and Vercel gates all pass | In progress — the application candidate is certified and content-equivalent through the security-workflow head; final owner-controlled recovery, security, and operational gates remain open |
| Tenant isolation | Database, Storage, API, and generated outputs deny cross-workspace access | Candidate `2b74d93` passes the permanent clean-migration two-tenant CI gate; composite tenant foreign keys and Storage/output assertions are included | Pass on candidate SHA |
| Roles | Admin, approver, and member permissions are server-enforced and browser-verified | Candidate `4f01b55` combines the admin/member lifecycle journey with distinct authenticated admin/author and approver browser sessions for concurrent generation, submission, approval, and export; every approval was recorded once at the exact revision | Pass on candidate SHA |
| Admin MFA | Every beta workspace administrator uses an MFA-backed session for sensitive administration | Candidate `2b74d93` proved AAL1 redirect, TOTP enrollment, AAL2 step-up, and sensitive administration on its exact Preview | Pass on candidate SHA; named beta admins still require enrollment |
| Enterprise SSO | One design-partner SAML/OIDC provider is verified, or the partner accepts a written password/MFA beta limitation | No application SSO implementation or partner IdP is selected | Partner-dependent |
| User lifecycle | Invite, role assignment, disable/restore, live-JWT data-access cutoff, Auth re-entry blocking, and access review are auditable | Candidate `2b74d93` passed exact-Preview role change, disable/restore, stale-JWT cutoff, blocked fresh sign-in, pending-invite cancellation, and matching receipts; teardown left zero disposable organizations, profiles, or Auth users | In progress — real invitation delivery/resend and the first signed access review remain |
| Audit history | Admins can retrieve tenant-scoped events; export is bounded, safe for spreadsheets, and the export itself is recorded | Candidate `2b74d93` passed exact-Preview tenant-scoped CSV export, `audit.exported` receipt, and a restored non-admin member's `403`; unit contracts prove the 10,000-row bound and spreadsheet-formula shielding | Pass on candidate SHA |
| Data inventory | Stored customer data, subprocessors, regions, and purpose are documented | Machine-checked 29-table/control-plane/Auth/Storage inventory and processor-purpose record exist; exact processor regions, DPAs, and retention require owner approval | Partial — technical inventory complete; procurement inputs open |
| Retention and deletion | Defaults, legal holds, customer export, deletion approval, and deletion receipt are documented and tested | Bounded hashed export, service-only receipts, legal-hold block, dual approval, exact confirmation, supported Storage/Auth deletion, and surviving global evidence passed the disposable staging drill; candidate `2b74d93` passes the exact remote migration and contract gates | In progress — policy-owner approval pending |
| Backup and recovery | Backup/PITR is configured and a staging restore drill proves the documented RTO/RPO | Pro daily database backup posture and exact Supabase region are documented; recommended RTO/RPO, PITR/Storage requirements, and drill procedure are defined | Missing — purchase/owner approval and timed restore drill required |
| Availability | Health, worker liveness, queue recovery, provider retry, and failure alerts have owners | Health/worker checks, structured logs, a daily authenticated backstop, and bounded authenticated incident webhook are implemented. Candidate `76d5fa5` passed safe Ask/generation exhaustion paths and visibly reported both incident attempts as unconfigured | In progress — five-minute external/plan-backed monitor, real route, named owner, and delivered synthetic alert required |
| Capacity | Concurrent login, upload, Ask, generation, review, and export meet an approved beta envelope | Read gate: 20 health probes, 5 simultaneous sign-ins, and 20 authenticated route loads. Candidate `4f01b55` also passed 2 simultaneous uploads, 2 grounded Ask requests, 2 generations, 2 distinct approval workflows, and 3 approved exports; all bounded data was disposed and production was untouched | Pass for the documented design-partner beta envelope; not an SLA or general-scale claim |
| Incident response | Severity model, rollback, communications, evidence preservation, and an exercised tabletop exist | Production release/rollback steps and severity table exist. Candidate `76d5fa5` proves safe provider degradation and visible incident-routing failure; owners, delivered alert, and tabletop evidence are absent | Partial |
| Security | No known P0/P1, no high production dependency vulnerability, advisors reviewed, leaked-password protection enabled, and scoped independent testing has no unresolved critical/high finding | Dependency audit, CodeQL security-extended, Dependabot, and secret scanning report zero open findings; Supabase advisors report zero errors. Leaked-password protection and independent testing remain open | Partial |
| Accessibility | Automated WCAG-oriented checks plus keyboard, 200% zoom, reduced-motion, touch-target, announcement, and representative assistive-technology evidence pass | Claude's integrated UI SHA passed the route/viewport and manual keyboard/zoom/motion/touch checks. Exact-Preview automation passes, and a representative Chrome accessibility-tree audit exposes correct landmarks, headings, named controls, and live regions across five primary surfaces | In progress — human assistive-technology observation remains |
| Privacy and customer assurance | Security overview, data flow, retention/deletion, incident contact, DPA/subprocessor inputs, and known beta limitations are reviewable | [Enterprise-beta assurance pack](./ENTERPRISE_BETA_ASSURANCE_PACK.md) consolidates the technical controls, data flow, processor inputs, security/recovery/accessibility posture, limitations, reviewer scope, and acceptance record | In progress — named owner review, processor/legal inputs, and design-partner acceptance remain |
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
- [x] Establish the beta capacity envelope and pass representative login,
  upload, Ask, generation, review, and export concurrency.
- [x] Exercise controlled provider timeout/failure paths and attach bounded
  retry, safe-error, telemetry, and incident-routing-attempt evidence without
  disrupting production.
- [ ] Configure a real incident destination and named owner, then prove one
  delivered synthetic alert and human acknowledgement.
- [ ] Route health and error signals to a named incident owner and exercise one
  rollback/communications tabletop.
- [ ] Enable leaked-password protection and close every critical/high finding
  from a scoped independent security assessment.
- [ ] Complete manual accessibility evidence and record any contractual
  limitation without overstating certification.
- [x] Publish the design-partner-review draft of the customer-facing beta
  security/privacy/operations assurance pack.
- [ ] Complete named owner, processor/legal, and independent-review inputs and
  get written design-partner acceptance of beta limitations.

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
