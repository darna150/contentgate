-- Brand guides and source documents are governed assets even when they do not
-- have a safe inline preview.
alter table public.product_assets
  drop constraint if exists product_assets_asset_type_check,
  add constraint product_assets_asset_type_check
    check (asset_type in ('logo', 'packshot', 'background', 'image', 'video', 'document')),
  drop constraint if exists product_assets_media_kind_check,
  add constraint product_assets_media_kind_check
    check (media_kind in ('image', 'video', 'document'));

update storage.buckets
set allowed_mime_types = array[
  'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
]
where id = 'product-assets';

alter table public.asset_media_jobs
  drop constraint if exists asset_media_jobs_type_valid,
  add constraint asset_media_jobs_type_valid
    check (job_type in ('image_derivatives', 'video_probe', 'video_transcode', 'video_poster', 'document_metadata'));
