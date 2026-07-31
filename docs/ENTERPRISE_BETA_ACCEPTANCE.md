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
| Exact build | Claude UI is integrated once; local, CI, Preview, browser, live-AI, role, recovery, onboarding, log, and security gates all name the same SHA | Claude `c007408` is integrated once. Application SHA `602edbd` passed the exact Preview provider-failure and stateful happy-path regressions. Final application candidate `a5e1408` adds only CodeQL, assurance documents, the tested Pro cron, and fail-closed incident configuration; its CodeQL, verify, 93-migration tenant-isolation, Preview accessibility/E2E, Vercel, and complete enterprise identity journey pass | In progress — current application engineering gates pass; owner-controlled recovery, independent security/accessibility, production operations, and acceptance remain open |
| Tenant isolation | Database, Storage, API, and generated outputs deny cross-workspace access | Candidate `2b74d93` passes the permanent clean-migration two-tenant CI gate; composite tenant foreign keys and Storage/output assertions are included | Pass on candidate SHA |
| Roles | Admin, approver, and member permissions are server-enforced and browser-verified | Candidate `4f01b55` combines the admin/member lifecycle journey with distinct authenticated admin/author and approver browser sessions for concurrent generation, submission, approval, and export; every approval was recorded once at the exact revision | Pass on candidate SHA |
| Admin MFA | Every beta workspace administrator uses an MFA-backed session for sensitive administration | Candidate `a5e1408` proved AAL1 redirect, TOTP enrollment, AAL2 step-up, and sensitive administration on its exact Preview | Pass on final application candidate; named beta admins still require enrollment |
| Enterprise SSO | One design-partner SAML/OIDC provider is verified, or the partner accepts a written password/MFA beta limitation | No application SSO implementation or partner IdP is selected | Partner-dependent |
| User lifecycle | Invite, role assignment, disable/restore, live-JWT data-access cutoff, Auth re-entry blocking, and access review are auditable | Candidate `a5e1408` passed exact-Preview role change, disable/restore, stale-JWT cutoff, blocked fresh sign-in, pending-invite cancellation, and matching receipts; independent teardown reads found zero disposable organizations, profiles, or Auth users | In progress — real invitation delivery/resend and the first signed access review remain |
| Audit history | Admins can retrieve tenant-scoped events; export is bounded, safe for spreadsheets, and the export itself is recorded | Candidate `a5e1408` passed exact-Preview tenant-scoped CSV export, `audit.exported` receipt, and a restored non-admin member's `403`; unit contracts prove the 10,000-row bound and spreadsheet-formula shielding | Pass on final application candidate |
| Data inventory | Stored customer data, subprocessors, regions, and purpose are documented | Machine-checked 29-table/control-plane/Auth/Storage inventory and processor-purpose record exist; exact processor regions, DPAs, and retention require owner approval | Partial — technical inventory complete; procurement inputs open |
| Retention and deletion | Defaults, legal holds, customer export, deletion approval, and deletion receipt are documented and tested | Bounded hashed export, service-only receipts, legal-hold block, dual approval, exact confirmation, supported Storage/Auth deletion, and surviving global evidence passed the disposable staging drill; candidate `2b74d93` passes the exact remote migration and contract gates | In progress — policy-owner approval pending |
| Backup and recovery | Backup/PITR is configured and a staging restore drill proves the documented RTO/RPO | Completed daily database backups were observed on both projects. The owner selected a lean-pilot target of up to 24-hour database RPO and four-hour service RTO, declined paid PITR, and did not approve a temporary restore target | Accepted limitation for platform readiness; unproven Storage recovery and the lack of a timed restore require first-client acceptance |
| Availability | Health, worker liveness, queue recovery, provider retry, and failure alerts have owners | Health/worker checks, structured logs, a Pro-compatible five-minute protected Vercel cron, a bounded authenticated incident webhook, and an authenticated idempotent Resend email adapter are implemented. Preview has a verified sender plus named owner and support destination | In progress — exact-Preview delivery/acknowledgement and later production activation remain required |
| Capacity | Concurrent login, upload, Ask, generation, review, and export meet an approved beta envelope | Read gate: 20 health probes, 5 simultaneous sign-ins, and 20 authenticated route loads. Candidate `4f01b55` also passed 2 simultaneous uploads, 2 grounded Ask requests, 2 generations, 2 distinct approval workflows, and 3 approved exports; all bounded data was disposed and production was untouched | Pass for the documented design-partner beta envelope; not an SLA or general-scale claim |
| Incident response | Severity model, rollback, communications, evidence preservation, and an exercised tabletop exist | Production release/rollback steps and severity table exist. Debbie Melgarejo is the named engineering, client-contact, and go/no-go owner; support and escalation mailboxes plus a verified Preview sender are configured | Partial — delivered alert acknowledgement and tabletop evidence remain |
| Security | No known P0/P1, no high production dependency vulnerability, advisors reviewed, leaked-password protection enabled, and scoped independent testing has no unresolved critical/high finding | Dependency audit, CodeQL security-extended, Dependabot, and secret scanning report zero open findings; Supabase advisors report zero errors. Leaked-password protection and independent testing remain open | Partial |
| Accessibility | Automated WCAG-oriented checks plus keyboard, 200% zoom, reduced-motion, touch-target, announcement, and representative assistive-technology evidence pass | Claude's integrated UI SHA passed the route/viewport and manual keyboard/zoom/motion/touch checks. Exact-Preview automation passes, and a representative Chrome accessibility-tree audit exposes correct landmarks, headings, named controls, and live regions across five primary surfaces | In progress — human assistive-technology observation remains |
| Privacy and customer assurance | Security overview, data flow, retention/deletion, incident contact, DPA/subprocessor inputs, and known beta limitations are reviewable | [Enterprise-beta assurance pack](./ENTERPRISE_BETA_ASSURANCE_PACK.md) consolidates the technical controls, data flow, processor inputs, security/recovery/accessibility posture, limitations, reviewer scope, and acceptance record | In progress — named owner review, processor/legal inputs, and design-partner acceptance remain |
| Beta operations | Named engineering owner, client-contact owner, go/no-go approver, support hours, escalation path, and design-partner acceptance are recorded | Debbie Melgarejo owns engineering incidents, client contact, and go/no-go. Support is Monday–Friday, 09:00–18:00 Asia/Manila; `security@contentgate.app` is the escalation contact. Client acceptance moves to the per-pilot onboarding gate | Pass for client-independent readiness; first-client acceptance remains onboarding work |

## Required beta gates

- [ ] Certify the combined enterprise SHA through the complete remote Preview,
  browser, live-AI, role, recovery, onboarding, log, and security suite.
- [x] Rerun the disposable AAL1/AAL2 administration journey on the final
  application candidate and independently prove zero staging residue.
- [ ] Enroll both named beta-workspace administrators before client access.
- [x] Browser-verify invite, role change, disable/restore, immediate blocked
  data access, Auth re-entry blocking, and receipts on the exact Preview.
- [x] Assign Debbie Melgarejo as access-review owner; complete the first signed
  review before client access.
- [x] Ship and browser-verify tenant-scoped audit export, including export
  receipts and spreadsheet-injection protection.
- [x] Test customer data export and guarded workspace deletion on a disposable
  staging workspace.
- [x] Assign Debbie Melgarejo as retention-policy owner; final policy review
  remains required before client access.
- [x] Record lean-pilot targets and the explicit no-PITR/no-temporary-restore
  decision; timed restore evidence is an accepted open limitation.
- [x] Establish the beta capacity envelope and pass representative login,
  upload, Ask, generation, review, and export concurrency.
- [x] Exercise controlled provider timeout/failure paths and attach bounded
  retry, safe-error, telemetry, and incident-routing-attempt evidence without
  disrupting production.
- [ ] Prove one delivered synthetic alert and human acknowledgement on the
  exact candidate; the real Preview destination and named owner are configured.
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
