-- Give Studio enough room for size-by-size generation during demos while
-- keeping an authenticated-user fixed-window guardrail around expensive AI calls.
create or replace function public.consume_api_rate_limit(p_scope text)
returns table (
  allowed boolean,
  request_limit integer,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_actor_id uuid := (select auth.uid());
  rate_limit integer;
  window_seconds integer;
  rate_window_start timestamptz;
  current_count integer;
  retry_seconds integer;
begin
  if rate_actor_id is null then
    raise exception 'authentication required';
  end if;

  case p_scope
    when 'knowledge.ask' then
      rate_limit := 10;
      window_seconds := 60;
    when 'content.generate' then
      rate_limit := 20;
      window_seconds := 300;
    when 'legacy.generate' then
      rate_limit := 3;
      window_seconds := 300;
    else
      raise exception 'unsupported rate limit scope';
  end case;

  rate_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.api_rate_limits (
    scope, actor_id, window_start, request_count
  ) values (
    p_scope, rate_actor_id, rate_window_start, 1
  )
  on conflict (scope, actor_id, window_start)
  do update set request_count = private.api_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from private.api_rate_limits
  where actor_id = rate_actor_id
    and window_start < clock_timestamp() - interval '1 day';

  retry_seconds := greatest(
    1,
    ceil(extract(epoch from (
      rate_window_start + make_interval(secs => window_seconds) - clock_timestamp()
    )))::integer
  );

  return query select
    current_count <= rate_limit,
    rate_limit,
    greatest(rate_limit - current_count, 0),
    retry_seconds;
end;
$$;

revoke execute on function public.consume_api_rate_limit(text)
  from public, anon, service_role;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
