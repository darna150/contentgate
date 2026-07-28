create or replace function public.record_product_asset_download(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_org_id uuid;
  caller_role text;
  asset_org_id uuid;
  asset_status text;
begin
  if caller_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  select org_id, role
    into caller_org_id, caller_role
  from public.profiles
  where id = caller_id;

  if caller_org_id is null then
    raise exception 'Profile not found' using errcode = '28000';
  end if;

  select org_id, approval_status
    into asset_org_id, asset_status
  from public.product_assets
  where id = p_asset_id;

  if asset_org_id is null or asset_org_id <> caller_org_id then
    raise exception 'Asset not found' using errcode = 'P0002';
  end if;

  if asset_status <> 'approved' and caller_role <> 'admin' then
    raise exception 'This asset can be downloaded after approval.' using errcode = '42501';
  end if;

  update public.product_assets
  set
    download_count = coalesce(download_count, 0) + 1,
    last_downloaded_at = now()
  where id = p_asset_id
    and org_id = caller_org_id;
end;
$$;

revoke all on function public.record_product_asset_download(uuid) from public;
revoke all on function public.record_product_asset_download(uuid) from anon;
grant execute on function public.record_product_asset_download(uuid) to authenticated;
