-- Reset the live demo from the old animal-health sample universe to the
-- ContentGate product direction. This intentionally keeps the ContentGate
-- product and its two Figma-backed templates, removes old demo products and
-- knowledge, then seeds deeper ContentGate demo knowledge for previews.

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.knowledge_queries query
using contentgate
where query.org_id = contentgate.org_id;

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.notebook_sessions session
using contentgate
where session.org_id = contentgate.org_id;

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.documents document
using contentgate
where document.org_id = contentgate.org_id;

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.product_claims claim
using contentgate
where claim.product_id = contentgate.id;

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.product_templates template
using contentgate
where template.product_id = contentgate.id
  and template.layout_key not in (
    'contentgate_local_friendly',
    'contentgate_local_premium'
  );

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
delete from public.products product
using contentgate
where product.org_id = contentgate.org_id
  and product.id <> contentgate.id;

update public.organizations organization
set
  name = 'ContentGate Demo',
  industry = 'Brand Content Operations'
where organization.id = (
  select org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
);

update public.products
set
  name = 'ContentGate',
  description = 'Brand-content workspace for distributed teams that need localized posts, banners, flyers, promos, and approval-ready marketing assets from controlled templates.',
  disclaimer_text = 'Demo guidance: localized content should be reviewed against approved brand, legal, channel, and market requirements before publishing.',
  status = 'active'
where id = '20000000-0000-0000-0000-000000000001'::uuid;

insert into public.product_claims (
  org_id,
  product_id,
  claim_text,
  status
)
select
  product.org_id,
  product.id,
  claim.claim_text,
  'approved'
from public.products product
cross join (
  values
    ('ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge.'),
    ('ContentGate is designed for branch teams, franchise operators, dealers, distributors, regional teams, sales reps, field teams, and agency partners who need ready-to-use local content.'),
    ('Local users can edit approved fields such as headline, supporting copy, location detail, call to action, date, offer, market language, and image selection.'),
    ('Brand administrators can lock layout, typography, colors, logo use, brand controls, and approval requirements so local teams cannot accidentally break the design system.'),
    ('Templates can support multiple output sizes, including square posts, stories, portrait posts, link ads, leaderboard banners, and medium rectangle display ads.'),
    ('ContentGate positions Figma as the design source of truth while the app turns selected template systems into guided, controlled production workflows.'),
    ('The platform supports approval-ready content workflows where drafts can be created, reviewed, approved, rejected, revised, and exported with governance history.'),
    ('The Knowledge Hub gives teams a searchable source of approved product, brand, campaign, legal, and localization guidance.'),
    ('AI assistance should use only approved ContentGate knowledge and should avoid inventing features, claims, pricing, integrations, or customer guarantees.'),
    ('ContentGate is not a finance platform, fund-management tool, or campaign-planning system; it is centered on brand assets, localized content, templates, approvals, and production workflows.'),
    ('The recommended MVP keeps the scope focused on digital asset management, template customization, AI copy suggestions, approvals, search, and role-based access.'),
    ('Future expansion may include richer analytics, real-time collaboration, deeper integrations, and advanced Figma template import once the core workflow is reliable.')
) as claim(claim_text)
where product.id = '20000000-0000-0000-0000-000000000001'::uuid;

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
),
uploader as (
  select profile.id
  from public.profiles profile
  join contentgate on contentgate.org_id = profile.org_id
  order by case when profile.role = 'admin' then 0 else 1 end, profile.created_at
  limit 1
),
demo_documents(document_id, title, paragraphs) as (
  values
    (
      'c1000000-0000-0000-0000-000000000001'::uuid,
      'ContentGate Platform Overview and Positioning',
      array[
        'ContentGate is a brand-content management platform for companies that need to create, organize, customize, approve, and reuse marketing assets across many local teams. The product is closest to platforms such as Sesimi, Brandfolder, Bynder, Frontify, Canto, Marvia, and Canva for Teams, but its MVP should stay sharply focused on guided localized content production rather than becoming a broad campaign or finance tool.',
        'The core customer is a distributed organization where headquarters owns the brand system and local operators need fast, practical content. Examples include franchises, dealerships, retail branches, real estate networks, estate sale operators, regional sales teams, distributors, agencies managing multiple territories, and field teams that need local posts, banners, flyers, and sale materials.',
        'The key promise is simple: local teams can make useful content without becoming designers, while brand teams keep the design system intact. Editable fields should be intentional and limited, such as headline, subheadline, local detail, call to action, date, offer, market language, location, and selected imagery. Locked fields should include layout, typography, logo placement, color palette, required disclaimers, and approval rules.',
        'ContentGate should present Figma as the design source of truth for high-quality templates. Designers can create approved template families in Figma, including multiple ad sizes or format variations, and the app can translate those systems into controlled production experiences. The production app should not ask non-designers to manipulate arbitrary layers; it should guide them through safe fields and preview-ready outputs.',
        'The platform should support an asset library where approved brand images, logos, campaign materials, screenshots, sale photos, background images, and supporting media can be uploaded, tagged, searched, filtered, previewed, and attached to products or workspaces. Asset organization should feel like a lightweight digital asset manager first, not a generic file dump.',
        'The Knowledge Hub is the approved source layer for AI suggestions and content guidance. It should contain product descriptions, brand rules, localization guidance, claims, disclaimers, campaign notes, channel rules, and internal operating guidance. AI-generated copy should be grounded in this knowledge and should avoid claims that are not present in approved sources.',
        'Approvals are part of the product value because localized content often carries brand, legal, or channel risk. Drafts should be easy to review, approve, reject, revise, and export. History should make it clear who generated, edited, submitted, approved, rejected, or exported a piece of content.',
        'The MVP should avoid funds management, broad campaign calendars, budget tracking, media buying, complex project management, and overly open-ended design editing. Those features can distract from the main wedge: high-quality branded content production for distributed teams.'
      ]
    ),
    (
      'c1000000-0000-0000-0000-000000000002'::uuid,
      'MVP Scope and Product Boundaries',
      array[
        'The MVP scope should prove that ContentGate can turn approved brand knowledge and design templates into high-quality localized assets. The first release should prioritize products or workspaces, approved knowledge, an asset library, locked templates, editable fields, AI-assisted copy suggestions, review workflows, and export-ready previews.',
        'A product workspace should collect the practical things a team needs in one place: assets, approved knowledge, templates, generated content, and approvals. This structure is easier to understand than separating work across unrelated pages. It also reinforces that every piece of generated content belongs to a clear brand, product, campaign, or client context.',
        'Templates should be treated as controlled production systems rather than freeform design canvases. Each template should declare its editable fields, output sizes, locked fields, renderer, Figma source metadata, copy limits, and overflow rules. If copy does not fit, the app should guide revision rather than allowing ugly broken layouts.',
        'For a demo, the highest-value template family is localized company content: posts and ads that help local branches or partners announce offers, events, services, sales, or updates while keeping the central brand intact. This is easier for buyers to understand than a hypothetical animal-health product catalog.',
        'The first template workflow should support two design sets: a friendly practical set for local teams and a premium brand-led set for headquarters or decision makers. Both sets can share the same authoring fields so users experience variation without learning a new workflow every time.',
        'The MVP should include role-based access. Admins manage products, templates, knowledge, and assets. Members generate and edit allowed drafts. Approvers review and approve content. This is enough to demonstrate governance without building a heavy enterprise permission matrix too early.',
        'The app should provide search and filtering across assets and knowledge so users can find the right approved materials quickly. Search should start simple and become richer over time with tags, product scope, asset type, approval state, and usage metadata.',
        'Out of scope for the MVP: campaign budget planning, funds management, media buying, full project management, deep analytics dashboards, complex localization pipelines, arbitrary Figma layer editing, and open-ended AI image generation. These may be future capabilities, but they should not define the first demo.'
      ]
    ),
    (
      'c1000000-0000-0000-0000-000000000003'::uuid,
      'Template System and Figma Source of Truth',
      array[
        'ContentGate templates should begin in Figma because the product is selling design quality. Figma lets the design team control composition, typography, spacing, brand colors, image treatments, logo placement, and multi-size systems before anything reaches production users.',
        'A Figma template family can contain multiple output sizes such as square, story, portrait, link ad, leaderboard, and medium rectangle. These should be treated as deliberate variations, not automatic crops. Each size needs its own composition rules so the result feels designed instead of mechanically resized.',
        'Editable content should be limited to fields that a local user can safely understand. Good fields include headline, subheadline, local detail, CTA, date, offer, location, market language, audience, and approved image choice. Riskier elements such as layout, typography, logo, colors, required disclaimers, spacing, and brand controls should stay locked.',
        'Background images and supporting visuals should be replaceable when the template is designed for replacement. The replacement zone should preserve cropping rules, focal area, overlays, contrast, and safe margins. This is similar to the promise of systems such as Sesimi: local users can adapt the asset while the brand team protects the design.',
        'Not every Figma community template is ready for ContentGate. A template with only fixed backgrounds and no planned image slots can still be used as visual inspiration, but it needs a ContentGate-ready production version with named editable fields, image replacement zones, locked brand layers, and output-specific layout decisions.',
        'The app should store Figma metadata on the template record, including provider, file key, page or frame reference, version label, template family, template set, renderer, output sizes, and overflow policy. This makes it possible to trace production templates back to the approved design source.',
        'AI should not generate layouts. AI should help suggest copy that fits the approved fields and respects the source knowledge. The renderer should enforce the design system and copy limits so generated text cannot stretch, overlap, or visually damage the template.',
        'A strong future direction is a Figma import or mapping workflow where admins can connect a Figma file, select approved frames, map editable text and image regions, define field limits, and publish a controlled template into ContentGate. That should come after the first locked template workflow proves stable.'
      ]
    ),
    (
      'c1000000-0000-0000-0000-000000000004'::uuid,
      'Localization Workflow and User Roles',
      array[
        'The localization workflow should be designed for people who are not marketers. A branch manager, sales rep, distributor, franchise owner, or local operator should be able to select a template, enter local details, choose an approved image, ask for copy help, preview the result, and submit it for approval without needing design software.',
        'A common workflow starts with headquarters publishing a template set for a campaign or evergreen brand need. The local team chooses the relevant template, enters a market, location, date, offer, or event detail, and receives copy options that stay within approved claims and brand tone.',
        'The app should make the difference between editable and locked obvious. Editable fields are the local team’s responsibility. Locked fields are brand-owned. This separation protects design quality and reduces the chance that local content becomes inconsistent or off-brand.',
        'Approvers should see the rendered asset, the structured fields, the generated copy, the source template, and any relevant knowledge citations or guidance. They should be able to approve, reject with notes, or request revision. The user should then understand exactly what needs to change.',
        'Admins should be able to manage product/workspace configuration, approved knowledge, assets, and templates. Members should create and edit drafts but not change locked brand rules. Approvers should review content but should not automatically gain template administration rights unless they are also admins.',
        'The workflow should support localized image replacement when approved by the template. For example, a branch might replace a background with a local storefront, sale item, team photo, property image, event image, or market-specific visual. The design should preserve crop, contrast, and overlay rules so the output remains polished.',
        'Copy suggestions should sound natural and practical. ContentGate should avoid jargon-heavy language for local users. Strong examples include: Local content, made on brand. Ready-to-use posts for every market. Give every branch content they can actually use. Keep the brand tight while local teams move fast.',
        'The workflow should favor confidence over complexity. The best demo experience is not a huge set of tools; it is a short path from approved template to polished localized content that looks like it came from a skilled brand team.'
      ]
    ),
    (
      'c1000000-0000-0000-0000-000000000005'::uuid,
      'Demo Narrative, Buyer Value, and Sample Use Cases',
      array[
        'The demo story should start with the pain: distributed companies need local content all the time, but local teams often lack design skills, approved assets, and brand guidance. Headquarters wants control, local teams want speed, and the result is usually a messy mix of one-off requests, reused files, and off-brand edits.',
        'ContentGate solves this by giving teams one approved place for brand assets, knowledge, templates, content drafts, and approvals. The buyer should immediately understand that the platform reduces repetitive design requests while improving consistency across local markets.',
        'A strong example use case is a franchise network launching a seasonal offer. Headquarters creates the approved Figma template set and uploads campaign guidance. Each location customizes the offer date, city, CTA, local detail, and approved image. The result is a set of polished local ads that still feel like one brand.',
        'Another use case is an estate sale or local services operator that needs recurring sale content. A team can reuse approved templates for item highlights, sale announcements, location banners, email graphics, and social posts while keeping brand style consistent from sale to sale.',
        'A distributor or dealer network can use ContentGate to localize product announcements without rewriting claims from scratch. The Knowledge Hub stores approved positioning, disclaimers, product details, and channel guidance. Local teams can generate copy suggestions that stay inside approved boundaries.',
        'An agency can use ContentGate for multi-client production when each client has strict brand rules. The agency can manage client workspaces, approved asset libraries, template sets, and approval flows while giving account teams a faster way to produce recurring content.',
        'The business value should be framed around speed, quality, and control. ContentGate helps teams reduce manual design bottlenecks, produce more localized content, protect brand consistency, and maintain a review trail for content that needs approval.',
        'The product should avoid promising that AI replaces designers. The better message is that designers create better systems, and ContentGate lets more teams use those systems safely. This keeps the product premium and brand-focused rather than looking like another generic AI content generator.'
      ]
    )
)
insert into public.documents (
  id,
  org_id,
  uploaded_by,
  title,
  storage_path,
  content_text,
  paragraphs,
  product,
  product_id,
  created_at
)
select
  demo_documents.document_id,
  contentgate.org_id,
  uploader.id,
  demo_documents.title,
  null,
  array_to_string(demo_documents.paragraphs, E'\n\n'),
  (
    select jsonb_agg(
      jsonb_build_object('n', paragraph.ordinality, 'text', paragraph.text)
      order by paragraph.ordinality
    )
    from unnest(demo_documents.paragraphs) with ordinality as paragraph(text, ordinality)
  ),
  'ContentGate',
  contentgate.id,
  now()
from demo_documents
cross join contentgate
cross join uploader
on conflict (id) do update set
  org_id = excluded.org_id,
  uploaded_by = excluded.uploaded_by,
  title = excluded.title,
  storage_path = excluded.storage_path,
  content_text = excluded.content_text,
  paragraphs = excluded.paragraphs,
  product = excluded.product,
  product_id = excluded.product_id;
