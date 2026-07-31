create index if not exists onboarding_runs_organization_idx
  on public.onboarding_runs (organization_id)
  where organization_id is not null;

create index if not exists onboarding_user_provisioning_org_idx
  on private.onboarding_user_provisioning (org_id);
