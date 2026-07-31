/**
 * Creates an isolated, reusable demo tenant and runs its assets through the
 * same worker queue used by the Asset Library. Staging only: it requires an
 * explicit DEMO_SEED_CONFIRMATION value so it cannot be run accidentally.
 *
 * Usage:
 *   DEMO_SEED_CONFIRMATION=staging-demo npx tsx scripts/seed-staging-dam-demo.ts <hero-image> <launch-reel>
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const [heroPath, videoPath] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (process.env.DEMO_SEED_CONFIRMATION !== "staging-demo") throw new Error("Set DEMO_SEED_CONFIRMATION=staging-demo.");
if (!url?.includes("bncwjibscptgijgmuhrn") || !serviceKey) throw new Error("This script is intentionally limited to the Content Gate staging project.");
if (!heroPath || !videoPath) throw new Error("Provide a hero image and launch reel path.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const orgId =
  process.env.CONTENTGATE_DEMO_ORG_ID ??
  "77777777-7777-4777-8777-777777777777";
const email =
  process.env.CONTENTGATE_DEMO_EMAIL ??
  "demo-admin@northstar-dam.example";
const password = process.env.CONTENTGATE_DEMO_PASSWORD;
if (!password) throw new Error("Set CONTENTGATE_DEMO_PASSWORD for the staging demo user.");

type DemoAsset = {
  title: string;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
  assetType: "image" | "video" | "document";
  category: string;
  description: string;
  altText: string;
  tags: string[];
};

async function ensureDemoUser() {
  const { error: provisionError } = await supabase.rpc("provision_user", {
    provision_email: email, provision_org_id: orgId, provision_role: "admin", provision_full_name: "Northstar Demo Admin",
  });
  if (provisionError) throw provisionError;
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = listed.users.find((user) => user.email === email);
  const user = existing ?? (await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Northstar Demo Admin" } })).data.user;
  if (!user) throw new Error("Could not create the demo administrator.");
  const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, org_id: orgId, role: "admin", full_name: "Northstar Demo Admin" });
  if (profileError) throw profileError;
  return user.id;
}

async function addAsset(asset: DemoAsset, uploadedBy: string) {
  const checksum = createHash("sha256").update(asset.bytes).digest("hex");
  const { data: existing, error: existingError } = await supabase
    .from("product_assets").select("id").eq("org_id", orgId).eq("title", asset.title).eq("checksum_sha256", checksum).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id;

  const id = randomUUID();
  const storagePath = `${orgId}/brand/${id}-${asset.fileName}`;
  const { error: uploadError } = await supabase.storage.from("product-assets").upload(storagePath, asset.bytes, { contentType: asset.mimeType, upsert: false });
  if (uploadError) throw uploadError;
  const metadata = asset.mimeType.startsWith("image/") ? await sharp(asset.bytes).metadata() : undefined;
  const { error: assetError } = await supabase.from("product_assets").insert({
    id, org_id: orgId, product_id: null, asset_type: asset.assetType, storage_path: storagePath,
    title: asset.title, description: asset.description, alt_text: asset.altText, original_file_name: asset.fileName,
    mime_type: asset.mimeType, file_size_bytes: asset.bytes.length, media_kind: asset.assetType === "document" ? "document" : asset.assetType,
    width_pixels: metadata?.width ?? null, height_pixels: metadata?.height ?? null,
    aspect_ratio: metadata?.width && metadata?.height ? metadata.width / metadata.height : null,
    checksum_sha256: checksum, category: asset.category, tags: asset.tags, approval_status: "processing", uploaded_by: uploadedBy,
  });
  if (assetError) throw assetError;
  const jobTypes = asset.assetType === "image" ? ["image_derivatives"] : asset.assetType === "video" ? ["video_probe", "video_poster", "video_transcode"] : ["document_metadata"];
  const { error: jobsError } = await supabase.from("asset_media_jobs").insert(jobTypes.map((job_type) => ({ org_id: orgId, asset_id: id, job_type, input: { source: "staging-demo" } })));
  if (jobsError) throw jobsError;
  const { error: auditError } = await supabase.from("audit_log").insert({ org_id: orgId, actor_id: uploadedBy, action: "product_asset.demo_seeded", entity_type: "product_asset", entity_id: id, detail: { title: asset.title, source: "staging-demo" } });
  if (auditError) throw auditError;
  return id;
}

async function main() {
  const hero = await readFile(heroPath);
  const video = await readFile(videoPath);
  const document = Buffer.from("NORTHSTAR ROASTERS\n\nBrand voice\nWarm, precise, and quietly confident. Focus on craft, ritual, and origin without making unverified product claims.\n\nUsage\nUse the campaign image library for launch, retail, and social placements. Keep sufficient contrast and retain the supplied crop-safe space.\n", "utf8");
  const { error: orgError } = await supabase.from("organizations").upsert({ id: orgId, name: "Northstar Roasters — Demo", industry: "Specialty coffee" });
  if (orgError) throw orgError;
  const uploadedBy = await ensureDemoUser();
  const ids = await Promise.all([
    addAsset({ title: "Morning Ritual — Campaign Hero", fileName: "northstar-morning-ritual.png", bytes: hero, mimeType: "image/png", assetType: "image", category: "Campaign imagery", description: "Primary hero image for the Morning Ritual launch campaign.", altText: "Coffee bag and ceramic cup in warm morning light.", tags: ["launch", "hero", "lifestyle", "2026"] }, uploadedBy),
    addAsset({ title: "Morning Ritual — Launch Reel", fileName: "northstar-launch-reel.mp4", bytes: video, mimeType: "video/mp4", assetType: "video", category: "Campaign video", description: "Short social and retail launch reel, processed to a preview-safe MP4.", altText: "Slow moving campaign reel featuring the Northstar coffee product scene.", tags: ["launch", "reel", "social", "2026"] }, uploadedBy),
    addAsset({ title: "Northstar Brand Voice Guide", fileName: "northstar-brand-voice-guide.txt", bytes: document, mimeType: "text/plain", assetType: "document", category: "Brand guidelines", description: "Approved internal guide for voice and campaign-image usage.", altText: "Text document containing Northstar brand voice guidance.", tags: ["brand", "guidelines", "approved"] }, uploadedBy),
  ]);
  console.log(JSON.stringify({ orgId, email, assetsSeeded: ids.length, assetIds: ids }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : JSON.stringify(error));
  process.exitCode = 1;
});
