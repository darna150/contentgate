# End-to-end browser QA

ContentGate has a Playwright suite for the workflows most likely to regress in
front of a client:

- major app surface loading and broken-image checks
- ContentGate template generation
- Studio size switching, missing-size draft guardrails, and live text updates
- submit → approve → download export
- submit → reject-with-note visibility
- Knowledge Hub Ask on mobile, including composer clipping and approved-source answers

## Run against a Vercel preview

Use a disposable QA account that belongs to the demo organization. **Never run
against `contentgate-delta.vercel.app` (production)** — the `live-e2e.yml`
workflow hard-blocks that URL and the test suite will refuse to run against it.
Instead target a PR preview or a dedicated staging deployment.

```sh
CONTENTGATE_E2E_BASE_URL="https://contentgate-<pr-id>-debbies-projects-a8de6bb4.vercel.app" \
CONTENTGATE_E2E_EMAIL="qa-user@example.com" \
CONTENTGATE_E2E_PASSWORD="..." \
npm run test:e2e
```

The CI E2E gate (`.github/workflows/ci.yml`) discovers the Vercel preview URL
automatically via `vercel-action` and runs the suite against it on every PR.

For a visible browser:

```sh
CONTENTGATE_E2E_BASE_URL="..." \
CONTENTGATE_E2E_EMAIL="qa-user@example.com" \
CONTENTGATE_E2E_PASSWORD="..." \
npm run test:e2e -- --headed
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
npm run test:e2e
```

`CONTENTGATE_E2E_BASE_URL` defaults to `http://127.0.0.1:3000`.

## GitHub Actions

The `Live E2E QA` workflow is intentionally separate from normal CI because it
uses live credentials and can create generated content. Configure these
repository secrets:

- `CONTENTGATE_E2E_EMAIL`
- `CONTENTGATE_E2E_PASSWORD`
- optional `CONTENTGATE_E2E_ASSIGNMENT_ID`

The workflow can be run manually. It also runs on a daily schedule against
`https://contentgate-delta.vercel.app`.

## Reading failures

Playwright stores traces, screenshots, videos, and JSON attachments under
`test-results/` locally and as workflow artifacts in GitHub Actions. Start with:

1. the failing test name
2. the attached screenshot
3. `browser-issues.json`
4. the Playwright trace

If a generation test fails because of a temporary upstream AI or rate-limit
error, rerun once. If it fails twice, treat it as product instability.
