-- Cover the composite tenant foreign keys introduced for campaign-aware
-- onboarding and generated-content filtering.
create index if not exists campaigns_org_product_idx
  on public.campaigns (org_id, product_id);

create index if not exists generated_content_org_campaign_idx
  on public.generated_content (org_id, campaign_id)
  where campaign_id is not null;
