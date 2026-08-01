-- Source documents are compliance inputs. Make their approval state explicit
-- and ensure generation/lifecycle checks can consistently exclude withdrawn
-- material without deleting its audit history.

alter table public.documents
  add column if not exists approval_status text not null default 'approved';

update public.documents
set approval_status = 'approved'
where approval_status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_approval_status_valid'
  ) then
    alter table public.documents
      add constraint documents_approval_status_valid
      check (approval_status in ('approved', 'inactive'));
  end if;
end;
$$;

create index if not exists documents_approved_evidence_idx
  on public.documents (org_id, product_id, updated_at desc)
  where approval_status = 'approved';
