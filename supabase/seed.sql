-- ContentGate prototype seed: one org + three generic templates.
-- Run AFTER the migration. Sign up your own user afterwards — the
-- handle_new_user trigger makes the first user an admin of this org.

insert into organizations (id, name, industry)
values ('00000000-0000-0000-0000-000000000001', 'VetGlobal Animal Health', 'Animal Health');

insert into templates (org_id, name, description, prompt_body, output_type) values
(
  '00000000-0000-0000-0000-000000000001',
  'Social post',
  'Short, channel-ready social media post for a product.',
  'Write a social media feed post promoting the product described in the source documents. Keep it under 120 words, lead with the customer benefit, include one clear call to action, and use at most 2 relevant hashtags. Tone: confident, friendly, professional. Use ONLY claims that appear in the source documents.',
  'social'
),
(
  '00000000-0000-0000-0000-000000000001',
  'Promotional email',
  'Distributor or customer email announcing or promoting a product.',
  'Write a promotional email about the product described in the source documents. Structure: subject line, preview line, greeting, 2–3 short body paragraphs, bulleted key benefits (max 4), call to action, sign-off. Use ONLY claims that appear in the source documents.',
  'email'
),
(
  '00000000-0000-0000-0000-000000000001',
  'Product one-pager / flyer copy',
  'Print-ready flyer copy: headline, intro, benefits, usage, CTA.',
  'Write flyer copy for the product described in the source documents. Structure: headline (max 8 words), one-sentence subheading, short intro paragraph, 3–5 benefit bullets, a short "how to use" section if usage information exists in the sources, and a closing call to action. Use ONLY claims that appear in the source documents.',
  'flyer'
);
