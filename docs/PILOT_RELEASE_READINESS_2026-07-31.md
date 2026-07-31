# ContentGate pilot release readiness

Status date: July 31, 2026

## Current decision

The consolidated build is an engineering release candidate, not yet an
authorized production launch. PR #58 is the only release line. Production has
not been changed.

- CI-split implementation baseline: `6ad1d35`
- Last fully remote-certified head before the CI split: `3847222`
- Release branch: `codex/complete-build-source-of-truth`
- Claude UI branch: independently reviewed and merged into this branch only
  after its own Preview evidence is complete

Every gate must be rerun after Claude integration because evidence from a
different UI or SHA is not launch evidence.

## Engineering evidence complete

- Clean working tree and pushed release history.
- Full local tests, lint, typecheck, Next.js 16.2.12 production build, and
  production dependency audit pass; the audit reports zero vulnerabilities.
- All 85 canonical migrations replay cleanly in CI; two-tenant database and
  Storage isolation remain permanent gates.
- Staging has an exact 85-for-85 migration ledger and the release-facing Nimbus
  workspace contains no Aerform or Accessibility QA labels.
- Stateful E2E is blocked from every ContentGate production hostname by an
  executable, unit-tested Playwright guard.
- Nineteen deterministic browser tests remain merge-blocking. Seven provider-
  dependent generation and Ask tests are separately addressable as required
  live-AI launch evidence.
- The exact `6ad1d35` Preview passed every remote gate and all seven live-AI
  tests in 3.7 minutes. The deterministic lane passed 17 active tests with two
  intentionally unconfigured onboarding checks skipped; parallelizing its
  independent read-only scenarios reduced browser runtime from 4.0 to 2.5
  minutes without dropping a route or assertion.
- Expected fail-closed 422 generation refusals log as warnings; genuine
  provider, database, Auth, and rendering failures remain errors.
- Latest exact-candidate Ask evidence passes configured release thresholds:
  Recall@5 91.7%, answer-context recall 100%, forbidden-source hit rate 0,
  p95 latency 5.8 seconds, and average estimated cost $0.0094 per question.
- Vercel Analytics and Speed Insights are installed. The exact Preview had no
  fatal request failure. Its only error-classified line was a malformed first
  provider attempt that automatically retried to a successful 200; recovered
  attempts are now warnings, while exhausted retries remain errors.
- The exact `a74198d` Preview passed `verify`, clean migration replay/tenant
  isolation, Vercel deployment, and the deterministic browser suite. Its
  dedicated operator gate uploaded and preflighted a reviewed disposable ZIP,
  provisioned the workspace in 34 seconds, and replayed the identical package
  in 20 seconds. Database evidence showed one completed run—not a duplicate—
  with two users and exactly one product, campaign, document, claim, asset, and
  template assignment.
- The guarded staging cleanup then deleted both disposable Auth users and 31
  owned Storage objects. Post-cleanup evidence shows zero organization, user,
  domain-record, assignment, Auth-user, or Storage residue while preserving the
  immutable completed-run audit receipt. Production data and configuration
  were not touched.
- The Preview operator allowlist had drifted from the reviewed local staging
  value, causing `/onboarding` to redirect despite valid credentials. Only the
  encrypted Vercel Preview variable was corrected; the Production environment
  was not changed. The onboarding gate now also fails within 20 seconds when
  the operator surface or upload control is unavailable.

## Security and data evidence

Supabase reports no security `ERROR` on staging or production. Current findings:

- eight intentionally authenticated `SECURITY DEFINER` helpers/RPCs are pinned
  to controlled search paths and enforce authentication, tenant ownership, or
  bounded input before privileged writes;
- anonymous execution is revoked; privileged audit RPCs are not exposed to the
  service role except the two RLS lookup helpers whose service-role access is
  inherent to its database role;
- staging's four onboarding/worker tables with RLS and no browser policy are
  intentionally service-only and deny browser access;
- leaked-password protection is not enabled and remains a production
  configuration gate;
- performance advisor findings are index/policy optimization inputs, not a
  demonstrated isolation or correctness failure.

Advisor references:

- [Authenticated security-definer function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [RLS enabled without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Open production gates

These are required before go-live:

1. Integrate Claude's accepted UI commit and rerun every exact-SHA local, CI,
   Preview, browser, accessibility, live-AI, role, recovery, and onboarding gate.
2. Apply the six reviewed additive onboarding migrations using
   `PRODUCTION_RELEASE_RUNBOOK.md`; never run a blind canonical `db push` against
   the historical production ledger.
3. Enable Supabase leaked-password protection and confirm SMTP sender/delivery,
   Auth redirect URLs, production environment separation, and both custom
   domains.
4. Record a production backup/PITR point and the previous healthy Vercel
   deployment before promotion.
5. Complete the five-person Nimbus pilot protocol and record client acceptance.
6. Name the engineering incident owner, client-contact owner, and production
   go/no-go approver.

## Compliance boundary

The build has technical evidence for tenant isolation, least-privilege browser
access, approval-gated export, source-grounded generation, audit history,
recoverable onboarding, accessibility automation, and operational monitoring.
This report does not claim legal, regulatory, privacy, or accessibility
certification. Those decisions require the appropriate named reviewers and the
final production configuration.
