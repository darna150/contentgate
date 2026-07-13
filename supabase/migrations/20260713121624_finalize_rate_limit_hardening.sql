-- Close the final rate-limit advisor findings without granting table access.

create index if not exists api_rate_limits_actor_id_idx
  on private.api_rate_limits(actor_id);

drop policy if exists "deny direct rate limit access" on private.api_rate_limits;
create policy "deny direct rate limit access"
on private.api_rate_limits
as restrictive
for all
to authenticated
using (false)
with check (false);
