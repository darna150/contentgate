-- Prefer an unambiguous local name instead of a PL/pgSQL resolution mode.
-- `use_variable` fixes predicate RHS references, but it can also make an
-- ON CONFLICT column target resolve as the variable. These guarded rewrites
-- preserve real org_id column names and rename only local-variable uses.
do $migration$
declare
  definition text;
  rewritten text;
begin
  select pg_get_functiondef(
    'public.apply_onboarding_blueprint(uuid,uuid,jsonb,jsonb)'::regprocedure
  ) into definition;
  rewritten := replace(definition, E'#variable_conflict use_variable\n', '');
  rewritten := replace(rewritten, E'  org_id uuid;\n', E'  target_org_id uuid;\n');
  rewritten := replace(
    rewritten,
    E'  org_id := target_run.organization_id;\n',
    E'  target_org_id := target_run.organization_id;\n'
  );
  rewritten := replace(rewritten, 'profiles.org_id = org_id', 'profiles.org_id = target_org_id');
  rewritten := replace(rewritten, E'values (\n      org_id,', E'values (\n      target_org_id,');
  rewritten := replace(
    rewritten,
    E'''organizationId'', org_id,',
    E'''organizationId'', target_org_id,'
  );
  if rewritten = definition
    or position('target_org_id uuid' in rewritten) = 0
    or position(E'values (\n      org_id,' in rewritten) > 0
  then
    raise exception 'Could not safely rewrite apply_onboarding_blueprint';
  end if;
  execute rewritten;

  select pg_get_functiondef(
    'public.rollback_onboarding_run(uuid)'::regprocedure
  ) into definition;
  rewritten := replace(definition, E'#variable_conflict use_variable\n', '');
  rewritten := replace(rewritten, E'  org_id uuid;\n', E'  target_org_id uuid;\n');
  rewritten := replace(
    rewritten,
    E'  org_id := target_run.organization_id;\n',
    E'  target_org_id := target_run.organization_id;\n'
  );
  rewritten := replace(rewritten, 'if org_id is not null', 'if target_org_id is not null');
  rewritten := replace(rewritten, '= org_id', '= target_org_id');
  rewritten := replace(
    rewritten,
    'jsonb_build_object(''organizationId'', org_id)',
    'jsonb_build_object(''organizationId'', target_org_id)'
  );
  if rewritten = definition
    or position('target_org_id uuid' in rewritten) = 0
    or position('= org_id' in rewritten) > 0
  then
    raise exception 'Could not safely rewrite rollback_onboarding_run';
  end if;
  execute rewritten;
end;
$migration$;
