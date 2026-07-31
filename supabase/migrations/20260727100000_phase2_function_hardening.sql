-- These SECURITY DEFINER RPCs are intentionally callable by authenticated
-- users: they enforce tenant ownership before writing privileged audit data.
-- Pin schema resolution and remove service-role RPC access so the only
-- supported public caller is an authenticated app session.

alter function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  set search_path = '';
revoke all on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  from public, anon, service_role;
grant execute on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  to authenticated;

alter function public.record_product_asset_download(uuid)
  set search_path = '';
revoke all on function public.record_product_asset_download(uuid)
  from public, anon, service_role;
grant execute on function public.record_product_asset_download(uuid)
  to authenticated;
