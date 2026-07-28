/**
 * Run once daily in the protected worker environment after the retention
 * window. It deliberately skips any asset/version still pinned in generated
 * content; an operator must resolve that reference before a later retry.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: due, error: dueError } = await supabase
  .from("product_assets")
  .select("id, org_id, current_version_id")
  .not("archived_at", "is", null)
  .not("purge_after", "is", null)
  .lte("purge_after", new Date().toISOString())
  .is("purged_at", null)
  .limit(100);
if (dueError) throw dueError;

for (const asset of due ?? []) {
  const { data: versions, error: versionsError } = await supabase
    .from("product_asset_versions")
    .select("id, storage_path, preview_storage_path, poster_storage_path, transcoded_storage_path")
    .eq("asset_id", asset.id);
  if (versionsError) throw versionsError;
  const pinnedIds = [asset.id, ...(versions ?? []).map((version) => version.id)];
  const { data: content, error: contentError } = await supabase
    .from("generated_content")
    .select("id, structured_fields")
    .eq("org_id", asset.org_id);
  if (contentError) throw contentError;
  if ((content ?? []).some((row) => pinnedIds.some((id) => JSON.stringify(row.structured_fields).includes(id)))) {
    continue;
  }
  const paths = (versions ?? []).flatMap((version) => [
    version.storage_path,
    version.preview_storage_path,
    version.poster_storage_path,
    version.transcoded_storage_path,
  ]).filter((path): path is string => Boolean(path));
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from("product-assets").remove(paths);
    if (removeError) throw removeError;
  }
  const { error: purgeError } = await supabase
    .from("product_assets")
    .update({ purged_at: new Date().toISOString() })
    .eq("id", asset.id);
  if (purgeError) throw purgeError;
}
