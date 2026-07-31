-- Both onboarding functions intentionally keep the tenant identifier in a
-- local variable. PostgreSQL otherwise treats references such as
-- `profiles.org_id = org_id` as ambiguous when the statement is prepared.
-- Recompile the two existing functions with a function-local resolution rule;
-- this changes no signature, privilege, search path, or transaction boundary.
do $migration$
declare
  routine regprocedure;
  definition text;
begin
  foreach routine in array array[
    'public.apply_onboarding_blueprint(uuid,uuid,jsonb,jsonb)'::regprocedure,
    'public.rollback_onboarding_run(uuid)'::regprocedure
  ]
  loop
    select pg_get_functiondef(routine) into definition;
    if position(E'AS $function$\n' in definition) = 0 then
      raise exception 'Could not locate PL/pgSQL body for %', routine;
    end if;
    definition := replace(
      definition,
      E'AS $function$\n',
      E'AS $function$\n#variable_conflict use_variable\n'
    );
    execute definition;
  end loop;
end;
$migration$;
