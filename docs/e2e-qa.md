# End-to-end browser QA

ContentGate has two Playwright lanes for the workflows most likely to regress
in front of a client:

- a deterministic, merge-blocking PR lane for routes, accessibility, responsive
  behavior, authorization failures, Studio viewport behavior, the content
  ledger, approvals, and asset delivery;
- a credentialed live-AI lane for generation, refinement, fit behavior, export,
  and grounded Ask responses. This lane is launch-required evidence, but is kept
  separate so an upstream model refusal does not make a healthy build wait for
  the full PR retry window.

- major app surface loading and broken-image checks
- all 24 declared UI routes and their public, authenticated, dynamic,
  redirect, not-found, modal, and mobile accessibility states
- ContentGate template generation
- Studio size switching, missing-size draft guardrails, and live text updates
- submit → approve → download export
- submit → reject-with-note visibility
- Knowledge Hub Ask on mobile, including composer clipping and approved-source answers

## Run against a Vercel preview

Use a disposable QA account that belongs to the demo organization. **Never run
against `contentgate-delta.vercel.app` (production)** — the `live-e2e.yml`
workflow hard-blocks that URL and the test suite will refuse to run against it.
Instead target a PR preview or a dedicated staging deployment. The executable
target guard blocks `contentgate.app`, all of its subdomains, and the production
Vercel alias before a stateful suite starts.

```sh
CONTENTGATE_E2E_BASE_URL="https://contentgate-<pr-id>-debbies-projects-a8de6bb4.vercel.app" \
CONTENTGATE_E2E_EMAIL="qa-user@example.com" \
CONTENTGATE_E2E_PASSWORD="..." \
CONTENTGATE_E2E_ASSIGNMENT_ID="..." \
CONTENTGATE_E2E_CONTENT_ID="..." \
CONTENTGATE_E2E_DOCUMENT_ID="..." \
CONTENTGATE_E2E_PRODUCT_ID="..." \
CONTENTGATE_E2E_PRODUCT_NAME="..." \
CONTENTGATE_E2E_TEMPLATE_NAME="..." \
CONTENTGATE_E2E_OUTPUT_SIZE_KEY="..." \
CONTENTGATE_E2E_OUTPUT_SIZE_LABEL="..." \
CONTENTGATE_E2E_OUTPUT_WIDTH="1080" \
CONTENTGATE_E2E_OUTPUT_HEIGHT="1080" \
CONTENTGATE_E2E_KNOWLEDGE_QUESTION="..." \
npm run test:e2e:deterministic
```

The CI E2E gate (`.github/workflows/ci.yml`) discovers the Vercel preview URL
through the GitHub Deployments API and runs the deterministic suite against it
on every PR. Run the live-AI lane separately against the same exact candidate:

```sh
npm run test:e2e:live-ai
```

`npm run test:e2e` remains available when both lanes are intentionally required.

For a visible browser:

```sh
CONTENTGATE_E2E_BASE_URL="..." \
CONTENTGATE_E2E_EMAIL="qa-user@example.com" \
CONTENTGATE_E2E_PASSWORD="..." \
npm run test:e2e:deterministic -- --headed
```

## Run against local dev

Start the app in one terminal:

```sh
npm run dev
```

Then run Playwright in another terminal:

```sh
CONTENTGATE_E2E_EMAIL="qa-user@example.com" \
CONTENTGATE_E2E_PASSWORD="..." \
npm run test:e2e:deterministic
```

`CONTENTGATE_E2E_BASE_URL` defaults to `http://localhost:3000`.

To create or repair the dedicated fixture in a non-production Supabase
environment, load the QA password and server-only staging credentials, then
run `npm run qa:provision-accessibility`. The command is environment-guarded,
creates admin/member/approver QA identities plus deterministic product,
document, claim, and in-review content records, reuses an assigned published
template bundle, and never prints the password.

## Password-recovery smoke test

Run this journey against staging before promoting an authentication change.
The disposable helper requires the staging Supabase URL, service-role key,
`CONTENTGATE_ENVIRONMENT=staging`, and the exact staging project ref. It stages
the account in an existing tenant before creating the Auth user. By default it
uses the organization of `CONTENTGATE_E2E_EMAIL`; an explicit staging
organization UUID may be supplied as the final argument.

```sh
npm run qa:disposable-recovery -- create "qa+recovery@example.com"
# Or: npm run qa:disposable-recovery -- create "qa+recovery@example.com" "<staging-org-uuid>"
```

Then verify the full user-visible contract:

1. Request recovery from `/forgot-password` and confirm the screen gives the
   generic sent response.
2. Open the newest email from
   `accounts@notifications.contentgate.app` in a fresh tab or browser profile.
3. Confirm the link lands on `/reset-password`, not the dashboard, and shows
   the disposable address.
4. Save a new password, sign out, and sign in with that new password.
5. Sign out again before deleting the Auth user so no browser retains a session
   for a deleted identity.

Cleanup is mandatory, even after a failed assertion:

```sh
npm run qa:disposable-recovery -- delete "qa+recovery@example.com"
```

The journey passes only when delivery, token exchange, password update, and
password sign-in all succeed, the invalid/reused-link state remains usable, and
the final exact-email check shows no Auth user, profile, or pending provisioning
row. Never use a client employee account for this test and never run the helper
against production.

## GitHub Actions

The `Live E2E QA` workflow is intentionally separate from normal CI because it
uses live credentials, invokes model providers, and creates generated content.
It runs the `@live-ai` tests only. Configure these repository secrets:

- `CONTENTGATE_E2E_EMAIL`
- `CONTENTGATE_E2E_PASSWORD`
- `CONTENTGATE_E2E_ASSIGNMENT_ID`
- `CONTENTGATE_E2E_CONTENT_ID`
- `CONTENTGATE_E2E_DOCUMENT_ID`
- `CONTENTGATE_E2E_PRODUCT_ID`
- `CONTENTGATE_E2E_PRODUCT_NAME`
- `CONTENTGATE_E2E_TEMPLATE_NAME`
- `CONTENTGATE_E2E_OUTPUT_SIZE_KEY`, `CONTENTGATE_E2E_OUTPUT_SIZE_LABEL`,
  `CONTENTGATE_E2E_OUTPUT_WIDTH`, and `CONTENTGATE_E2E_OUTPUT_HEIGHT`
- `CONTENTGATE_E2E_KNOWLEDGE_QUESTION`

The onboarding receipt emits these client-neutral values from the package QA
configuration. The live workflow is manual-only and refuses the production URL.

## Reading failures

Playwright stores traces, screenshots, videos, and JSON attachments under
`test-results/` locally and as workflow artifacts in GitHub Actions. Start with:

1. the failing test name
2. the attached screenshot
3. `browser-issues.json`
4. the Playwright trace

If a generation test fails because of a temporary upstream AI or rate-limit
error, rerun once. If it fails twice, treat it as product instability.
