-- NotebookLM-style Ask retrieval:
-- product conversations can use product-specific source docs plus org-wide
-- source docs where product_id is null. Admins can therefore upload general
-- brand/claims/legal docs once and Ask can still cite them without manual
-- claim-source picking.

create or replace function public.search_product_knowledge(
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
language sql
stable
security invoker
set search_path = ''
as $$
  with product_scope as (
    select product.id, product.org_id
    from public.products as product
    where product.id = p_product_id
      and product.status = 'active'
      and product.org_id = (
        select profile.org_id
        from public.profiles as profile
        where profile.id = (select auth.uid())
      )
  ),
  query_terms as (
    select to_tsquery(
      'english',
      string_agg(quote_literal(term), ' | ' order by term)
    ) as query
    from unnest(
      tsvector_to_array(to_tsvector('english', coalesce(p_query, '')))
    ) as term
  ),
  paragraphs as (
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
      ) as paragraph_text
    from public.documents as document
    join product_scope on product_scope.org_id = document.org_id
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(document.paragraphs) = 'array' then document.paragraphs
        else '[]'::jsonb
      end
    ) with ordinality as item(value, ordinality)
    where document.product_id = product_scope.id
       or document.product_id is null
  ),
  ranked as (
    select
      paragraph.document_id,
      paragraph.document_title,
      paragraph.paragraph_n,
      paragraph.paragraph_text,
      ts_rank_cd(
        setweight(to_tsvector('english', paragraph.document_title), 'A') ||
        setweight(to_tsvector('english', paragraph.paragraph_text), 'B'),
        query_terms.query
      )::real as relevance
    from paragraphs as paragraph
    cross join query_terms
    where paragraph.paragraph_text <> ''
      and query_terms.query is not null
      and (
        setweight(to_tsvector('english', paragraph.document_title), 'A') ||
        setweight(to_tsvector('english', paragraph.paragraph_text), 'B')
      ) @@ query_terms.query
  )
  select
    ranked.document_id,
    ranked.document_title,
    ranked.paragraph_n,
    ranked.paragraph_text,
    ranked.relevance
  from ranked
  order by ranked.relevance desc, ranked.document_title, ranked.paragraph_n
  limit least(greatest(coalesce(p_limit, 12), 1), 20);
$$;

revoke all on function public.search_product_knowledge(uuid, text, integer) from public;
revoke all on function public.search_product_knowledge(uuid, text, integer) from anon;
grant execute on function public.search_product_knowledge(uuid, text, integer) to authenticated;
grant execute on function public.search_product_knowledge(uuid, text, integer) to service_role;
