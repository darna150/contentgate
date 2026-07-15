-- Store approved server-rendered exports in a private, org-scoped bucket and
-- attach the storage path to the completed render_jobs audit row.

insert into storage.buckets (id, name, public)
values ('rendered-assets', 'rendered-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "org rendered assets read" on storage.objects;
create policy "org rendered assets read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'rendered-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

drop policy if exists "org rendered assets insert" on storage.objects;
create policy "org rendered assets insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'rendered-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

drop policy if exists "org rendered assets update" on storage.objects;
create policy "org rendered assets update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'rendered-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  )
  with check (
    bucket_id = 'rendered-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

create or replace function public.record_render_job_event(
  p_content_id uuid,
  p_output_format text,
  p_input_sha256 text,
  p_payload jsonb default '{}'::jsonb,
  p_diagnostics jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  content_row record;
  inserted_id uuid;
  normalized_format text;
  output_path text;
begin
  normalized_format := case
    when p_output_format = 'jpeg' then 'jpg'
    else p_output_format
  end;

  if normalized_format not in ('jpg', 'pdf', 'png', 'svg') then
    raise exception 'unsupported render format';
  end if;

  if p_input_sha256 is null or p_input_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid render input hash';
  end if;

  output_path := nullif(p_payload->>'output_storage_path', '');

  select
    id,
    org_id,
    product_id,
    template_version_id,
    template_variant_id,
    renderer_version,
    status,
    current_revision_number,
    approved_revision_number
  into content_row
  from public.generated_content
  where id = p_content_id
    and org_id = public.auth_org_id();

  if not found then
    raise exception 'content not found';
  end if;

  if content_row.status <> 'approved'
     or content_row.approved_revision_number is null
     or content_row.approved_revision_number <> content_row.current_revision_number then
    raise exception 'only the currently approved revision can be rendered';
  end if;

  if content_row.template_version_id is null
     or content_row.template_variant_id is null then
    raise exception 'render jobs require a platform template version and variant';
  end if;

  if output_path is not null
     and output_path !~ ('^' || content_row.org_id::text || '/') then
    raise exception 'render output path must be scoped to the content organization';
  end if;

  insert into public.render_jobs (
    org_id,
    product_id,
    generated_content_id,
    template_version_id,
    template_variant_id,
    renderer_version,
    input_sha256,
    output_format,
    status,
    payload,
    diagnostics,
    output_storage_path,
    completed_at
  )
  values (
    content_row.org_id,
    content_row.product_id,
    content_row.id,
    content_row.template_version_id,
    content_row.template_variant_id,
    coalesce(content_row.renderer_version, 'template-platform-v1'),
    p_input_sha256,
    normalized_format,
    'completed',
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_diagnostics, '{}'::jsonb),
    output_path,
    now()
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  from public;
grant execute on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  to authenticated;
