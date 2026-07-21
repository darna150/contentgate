-- Replace OR-only tsquery with websearch_to_tsquery (AND + phrase) as primary
-- retrieval strategy, falling back to OR when the AND query returns no rows.
--
-- websearch_to_tsquery('english', 'how long flea protection lasts') produces
-- 'long' & 'flea' & 'protect' & 'last' — it only returns paragraphs that
-- contain ALL stemmed terms, eliminating the noisy partial-match results from
-- the OR approach. The OR fallback ensures very specific queries still find
-- something rather than returning nothing.

drop function if exists public.search_product_knowledge(uuid, text, integer);

create function public.search_product_knowledge(
  p_product_id uuid,
  p_query text,
  p_limit integer default 12
)
returns table (
  document_id uuid,
  document_title text,
  paragraph_n integer,
  paragraph_text text,
  relevance real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_ws_query tsquery;
  v_or_query tsquery;
  v_count integer;
begin
  -- resolve caller's org from their JWT; abort if not found
  select profile.org_id
  into v_org_id
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if v_org_id is null then
    return;
  end if;

  -- verify product scope (null = org-wide)
  if p_product_id is not null then
    if not exists (
      select 1
      from public.products as product
      where product.id = p_product_id
        and product.status = 'active'
        and product.org_id = v_org_id
    ) then
      return;
    end if;
  end if;

  -- primary: AND-based, phrase-aware tsquery from websearch syntax
  v_ws_query := websearch_to_tsquery('english', coalesce(p_query, ''));

  -- fallback: OR-based tsquery (original behavior)
  select to_tsquery(
    'english',
    string_agg(quote_literal(term), ' | ' order by term)
  )
  into v_or_query
  from unnest(
    tsvector_to_array(to_tsvector('english', coalesce(p_query, '')))
  ) as term;

  -- try websearch (AND) first
  if v_ws_query is not null then
    return query
    select
      document.id as document_id,
      document.title as document_title,
      case
        when jsonb_typeof(item.value) = 'object'
          and coalesce(item.value ->> 'n', '') ~ '^[0-9]+$'
          then (item.value ->> 'n')::integer
        else item.ordinality::integer
      end as paragraph_n,
      btrim(
        case
          when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
          when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
          else null
        end
      ) as paragraph_text,
      ts_rank_cd(
        setweight(to_tsvector('english', document.title), 'A') ||
        setweight(
          to_tsvector('english',
            btrim(case
              when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
              when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
              else ''
            end)
          ), 'B'),
        v_ws_query
      )::real as relevance
    from public.documents as document
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(document.paragraphs) = 'array' then document.paragraphs
        else '[]'::jsonb
      end
    ) with ordinality as item(value, ordinality)
    where document.org_id = v_org_id
      and (
        p_product_id is null
        or document.product_id = p_product_id
        or document.product_id is null
      )
      and btrim(case
        when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
        when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
        else ''
      end) <> ''
      and (
        setweight(to_tsvector('english', document.title), 'A') ||
        setweight(
          to_tsvector('english',
            btrim(case
              when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
              when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
              else ''
            end)
          ), 'B')
      ) @@ v_ws_query
    order by relevance desc, document.title, paragraph_n
    limit p_limit;

    get diagnostics v_count = row_count;
    if v_count > 0 then
      return;
    end if;
  end if;

  -- OR fallback: fires only when AND matched nothing
  if v_or_query is null then
    return;
  end if;

  return query
  select
    document.id as document_id,
    document.title as document_title,
    case
      when jsonb_typeof(item.value) = 'object'
        and coalesce(item.value ->> 'n', '') ~ '^[0-9]+$'
        then (item.value ->> 'n')::integer
      else item.ordinality::integer
    end as paragraph_n,
    btrim(
      case
        when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
        when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
        else null
      end
    ) as paragraph_text,
    ts_rank_cd(
      setweight(to_tsvector('english', document.title), 'A') ||
      setweight(
        to_tsvector('english',
          btrim(case
            when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
            when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
            else ''
          end)
        ), 'B'),
      v_or_query
    )::real as relevance
  from public.documents as document
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(document.paragraphs) = 'array' then document.paragraphs
      else '[]'::jsonb
    end
  ) with ordinality as item(value, ordinality)
  where document.org_id = v_org_id
    and (
      p_product_id is null
      or document.product_id = p_product_id
      or document.product_id is null
    )
    and btrim(case
      when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
      when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
      else ''
    end) <> ''
    and (
      setweight(to_tsvector('english', document.title), 'A') ||
      setweight(
        to_tsvector('english',
          btrim(case
            when jsonb_typeof(item.value) = 'object' then item.value ->> 'text'
            when jsonb_typeof(item.value) = 'string' then item.value #>> '{}'
            else ''
          end)
        ), 'B')
    ) @@ v_or_query
  order by relevance desc, document.title, paragraph_n
  limit p_limit;
end;
$$;

revoke all on function public.search_product_knowledge(uuid, text, integer) from public;
revoke all on function public.search_product_knowledge(uuid, text, integer) from anon;
grant execute on function public.search_product_knowledge(uuid, text, integer) to authenticated;
grant execute on function public.search_product_knowledge(uuid, text, integer) to service_role;
