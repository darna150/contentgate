-- `begin_onboarding_run` returns a column named run_id. On the retry path,
-- that output variable collides with onboarding_run_steps.run_id unless the
-- function explicitly prefers table columns for ambiguous SQL identifiers.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.begin_onboarding_run(text,text,jsonb,uuid,text)'::regprocedure
  ) into definition;
  if position(E'AS $function$\n' in definition) = 0 then
    raise exception 'Could not locate PL/pgSQL body for begin_onboarding_run';
  end if;
  definition := replace(
    definition,
    E'AS $function$\n',
    E'AS $function$\n#variable_conflict use_column\n'
  );
  execute definition;
end;
$migration$;
