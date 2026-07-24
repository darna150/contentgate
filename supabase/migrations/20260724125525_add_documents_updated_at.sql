-- Keep source-document browse and Ask fallback ordering stable.
--
-- The app orders approved source documents by updated_at. Older databases only
-- had created_at, so this fills the missing timestamp without rewriting
-- document content.

alter table public.documents
  add column if not exists updated_at timestamptz not null default now();

update public.documents
set updated_at = created_at
where updated_at is null;

create or replace function public.set_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_document_updated_at();

grant select, insert, update, delete on table public.documents to authenticated;
