# One-click client onboarding

## Outcome and operating target

An operator should be able to take a reviewed client package from preflight to a usable ContentGate workspace without editing SQL, source code, or database UUIDs.

The production target is:

- under 15 minutes of elapsed time for a normal package
- under 5 minutes of operator attention after the package is assembled
- zero duplicate workspaces when an identical package is retried
- zero cross-environment writes and zero partial tenant residue after a failed run
- a machine-readable receipt containing every resolved workspace, product, campaign, source, claim, asset, template, and assignment ID

“One click” describes the final operator action, not the package preparation. Source approval, asset rights, template design, and client sign-off remain explicit prerequisites.

## Package contract

Every package is a directory with a `blueprint.json` at its root. Binary files and template bundles are referenced by relative path.

```text
client-workspace/
  blueprint.json
  knowledge/
    approved-label.pdf
  assets/
    logo.png
    packshot.webp
  templates/
    launch/
      manifest.json
      ...bundle assets
```

The schema version is `contentgate-workspace-v1`. References use stable lowercase keys such as `sample-product`; database IDs are resolved by the provisioning run. The canonical example is [examples/onboarding/minimal-client/blueprint.json](../examples/onboarding/minimal-client/blueprint.json).

Current v1 safety limits are 50 users, 100 products, 500 campaigns, 1,000 documents, 5,000 claims, 2,000 assets, and 100 template bundles per package. These are reviewed guardrails, not database capacity claims.

## Safety model

Preflight is read-only. It validates the schema version, key uniqueness, all references, source/claim product alignment, safe package paths, readable documents, image contents, template manifests, required fields, and template copy fit.

Provisioning then enforces three independent environment checks:

1. `CONTENTGATE_ENVIRONMENT` names the intended environment.
2. `CONTENTGATE_SUPABASE_PROJECT_REF` must match the project encoded in `NEXT_PUBLIC_SUPABASE_URL`.
3. Production additionally requires `CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING=true` and the exact phrase `PROVISION <workspace-key> IN PRODUCTION`.

The service-role key and operator allowlist are server-only. The cross-tenant run tables have RLS enabled, no authenticated policies, and explicit service-role grants. Every SQL function is revoked from `PUBLIC`, `anon`, and `authenticated`.

Allowlisted operators get a **Platform → Client onboarding** route. The browser sends the ZIP directly to a private Supabase bucket with a two-hour signed upload token; the service-role key and package contents never cross the client boundary. Staged-package rows expire after two hours and are purged opportunistically on the next upload. Failed preflight, discard, success, and failure paths remove the object immediately. Provisioning is pinned to the exact digest shown during preflight, so replacing the staged object requires a fresh review.

## Transaction and recovery boundaries

Supabase Auth, Storage, and Postgres cannot participate in one distributed transaction. The runner therefore uses a saga:

1. create or resume an audited run and reserve the workspace key
2. create users with random inaccessible passwords through the trusted provisioning handshake
3. upload deterministic, run-scoped Storage objects
4. apply products, campaigns, documents, claims, and asset metadata in one Postgres transaction
5. preflight, import, publish, and assign template bundles
6. mark the run complete
7. send password-setup emails; delivery failures are reported for resend and do not destroy a completed workspace

Before completion, a failure removes tenant rows that block profile deletion, removes staged objects, deletes Auth users created by the run, then removes the empty organization. A completed run is never automatically deleted. Auth creation uses a short-lived, run-scoped provisioning token; concurrent packages cannot accidentally attach the same email to each other's organization.

The idempotency key is `(environment, canonical package SHA-256)`. The digest covers normalized blueprint data plus every referenced document, image, template manifest, and template asset checksum. An identical completed package returns its existing receipt; changing a binary without renaming it produces a different digest. Stable workspace and entity keys prevent a changed package from silently creating a duplicate tenant.

The first release is intentionally create-only. A changed package that reuses an existing workspace key fails clearly instead of mutating a live client workspace or creating a duplicate. A later reconciliation mode will need an explicit change preview, field-level ownership rules, archival semantics, and a rollback plan before it can safely make repeat client updates one click.

## Operator commands

The normal UI flow is: open `/onboarding`, choose the reviewed ZIP, select **Upload and preflight**, review the immutable hash and counts, then select **Create workspace**. The page also shows the last ten audited runs. Production renders the exact confirmation phrase and keeps the final button disabled until it matches.

The CLI uses the same preflight and provisioning engine and is the recovery/automation interface.

Read-only preflight:

```sh
npm run onboarding:preflight -- ./path/to/client-workspace
```

Provision staging:

```sh
CONTENTGATE_ENVIRONMENT=staging \
CONTENTGATE_SUPABASE_PROJECT_REF=your-staging-ref \
npm run onboarding:provision -- ./path/to/client-workspace \
  --operator-email operator@example.com
```

Production requires the temporary feature gate and exact confirmation. Do not keep the feature gate enabled after the reviewed run.

## Release sequence

1. Apply the control-plane migration to a dedicated staging project.
2. Configure the staging project ref, service role, app URL, and operator allowlist.
3. Run the minimal example and a package containing real documents, images, and a template bundle.
4. Re-run the identical package and confirm it returns the same receipt without writes.
5. Inject a failure at users, upload, core data, and template import; verify no tenant or object residue.
6. Provision two different packages concurrently and verify complete isolation.
7. Run the generic signed-in browser and axe journeys using the QA environment block from the receipt, including the resolved template assignment ID for generation coverage.
8. Verify the internal upload-and-create operator page with axe and keyboard navigation, then consider enabling reviewed production runs.

## Explicitly deferred

The current account model is one profile to one organization. Multi-workspace memberships and client self-service are separate migrations because they affect nearly every tenant policy. Campaigns in v1 are deliberately lightweight identity and grouping—not budgets, calendars, tasks, or a project-management subsystem. One-click reconciliation of changes into an existing workspace is also deferred from the create-only release; changed packages are blocked, never partially merged.
