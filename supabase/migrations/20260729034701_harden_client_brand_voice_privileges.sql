-- Hosted projects may still auto-grant broad Data API privileges on newly
-- created public tables. Reduce these tables to the app's actual operations.
revoke all privileges on table public.brand_voices from anon, authenticated;
revoke all privileges on table public.brand_voice_versions from anon, authenticated;

grant select, insert, update on table public.brand_voices to authenticated;
grant select, insert, update on table public.brand_voice_versions to authenticated;

create index if not exists brand_voices_org_current_version_idx
  on public.brand_voices (org_id, current_version_id)
  where current_version_id is not null;

drop policy if exists "admins create brand voice versions"
  on public.brand_voice_versions;
create policy "admins create brand voice versions"
  on public.brand_voice_versions for insert
  to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and created_by = (select auth.uid())
    and (select public.auth_role()) = 'admin'
  );
