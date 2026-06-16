-- Register Apex Canine's product-specific hybrid artwork.

update product_templates pt
set
  layout_key = case
    when pt.category in ('flyer', 'one_pager') then 'apex_canine_flyer'
    when pt.category = 'presentation' then 'apex_canine_presentation'
    else 'apex_canine_social'
  end,
  default_copy = case
    when pt.category = 'social' then '{
      "kicker":"VETERINARIAN-FORMULATED",
      "headline":"Complete daily\nnutrition for\nhealthier dogs.",
      "benefits":"AAFCO-standard nutrition · Prebiotics + probiotics · Omega fatty acid support",
      "subline":"Complete nutrition with real chicken, digestive support, and essential fatty acids.",
      "supportCopy":"Made with real chicken to support digestion, skin and coat, joints, and muscle maintenance.",
      "cta":"Discover Apex Canine"
    }'::jsonb
    when pt.category = 'flyer' then '{
      "headline":"Complete nutrition\nfor adult dogs\nfrom digestion\nto healthy coats",
      "benefits":"Real chicken as the first ingredient\nPrebiotic fiber and live probiotics\nOmega fatty acids for skin and coat",
      "cta":"Talk to your veterinarian",
      "contact":"Contact your local representative"
    }'::jsonb
    when pt.category = 'one_pager' then '{
      "headline":"Complete daily nutrition for healthier dogs.",
      "subheadline":"Veterinarian-formulated adult dog food with real chicken as the first ingredient.",
      "body":"Complete and balanced nutrition with prebiotic fiber, live probiotic cultures, essential fatty acids, glucosamine, and chondroitin.",
      "benefit_1":"Complete AAFCO-standard nutrition",
      "benefit_2":"Prebiotics and live probiotics",
      "benefit_3":"Omega-3 and Omega-6 support",
      "cta":"Discover Apex Canine",
      "contact":"Contact your local representative"
    }'::jsonb
    else '{
      "headline":"Complete daily nutrition for healthier dogs.",
      "subheadline":"Veterinarian-formulated nutrition for adult dogs of all breeds.",
      "body":"Real chicken, digestive support, essential fatty acids, and joint-supporting nutrients in every serving.",
      "cta":"Discover Apex Canine"
    }'::jsonb
  end
from products p
where pt.product_id = p.id
  and p.name = 'Apex Canine';
