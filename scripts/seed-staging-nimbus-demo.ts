/**
 * Adds a product-specific Nimbus shoe collection to the isolated staging DAM
 * demo. It deliberately shares the Northstar demo tenant, demonstrating that
 * product-bound and brand-wide assets coexist in one client library.
 *
 * Usage:
 *   DEMO_SEED_CONFIRMATION=staging-demo npx tsx scripts/seed-staging-nimbus-demo.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orgId =
  process.env.CONTENTGATE_DEMO_ORG_ID ??
  "77777777-7777-4777-8777-777777777777";
const email =
  process.env.CONTENTGATE_DEMO_EMAIL ??
  "demo-admin@northstar-dam.example";
if (process.env.DEMO_SEED_CONFIRMATION !== "staging-demo") throw new Error("Set DEMO_SEED_CONFIRMATION=staging-demo.");
if (!url?.includes("bncwjibscptgijgmuhrn") || !serviceKey) throw new Error("This script is intentionally limited to the Content Gate staging project.");
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const assetRoot = join(process.cwd(), "template-sources/nimbus-air-campaign/base-assets");

const definitions = [
  { source: "nimbus-1-electric-cobalt.png", title: "Nimbus 1 — Electric Cobalt Packshot", type: "packshot", category: "Product packshots", description: "Approved transparent product packshot for Nimbus 1 Electric Cobalt.", alt: "Electric cobalt Nimbus 1 running shoe on a transparent background.", tags: ["nimbus-1", "packshot", "electric-cobalt", "approved"] },
  { source: "nimbus-1-volt-lime.png", title: "Nimbus 1 — Volt Lime Packshot", type: "packshot", category: "Product packshots", description: "Approved transparent product packshot for Nimbus 1 Volt Lime.", alt: "Volt lime Nimbus 1 running shoe on a transparent background.", tags: ["nimbus-1", "packshot", "volt-lime", "approved"] },
  { source: "nimbus-1-chalk-bone.png", title: "Nimbus 1 — Chalk Bone Packshot", type: "packshot", category: "Product packshots", description: "Approved transparent product packshot for Nimbus 1 Chalk Bone.", alt: "Chalk bone Nimbus 1 running shoe on a transparent background.", tags: ["nimbus-1", "packshot", "chalk-bone", "approved"] },
  { source: "background-blush-speed.png", title: "Nimbus 1 — Blush Speed Background", type: "background", category: "Campaign backgrounds", description: "Campaign-safe background for Nimbus 1 social and launch formats.", alt: "Blush-toned abstract speed background for the Nimbus 1 campaign.", tags: ["nimbus-1", "background", "campaign", "social"] },
  { source: "background-warm-pavement.png", title: "Nimbus 1 — Warm Pavement Background", type: "background", category: "Campaign backgrounds", description: "Campaign-safe warm pavement background for retail and social layouts.", alt: "Warm pavement background for the Nimbus 1 campaign.", tags: ["nimbus-1", "background", "campaign", "retail"] },
] as const;

async function main() {
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error("Seed the Northstar demo tenant before adding Nimbus assets.");
  const { data: existingProduct, error: productReadError } = await supabase.from("products").select("id").eq("org_id", orgId).eq("name", "Nimbus 1 Running Shoe").maybeSingle();
  if (productReadError) throw productReadError;
  const productId = existingProduct?.id ?? (await supabase.from("products").insert({ org_id: orgId, name: "Nimbus 1 Running Shoe", description: "Demo product collection for the Nimbus 1 shoe launch.", status: "active" }).select("id").single()).data?.id;
  if (!productId) throw new Error("Could not create the Nimbus demo product.");

  const seeded: string[] = [];
  for (const item of definitions) {
    const bytes = await readFile(join(assetRoot, item.source));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const { data: duplicate, error: duplicateError } = await supabase.from("product_assets").select("id").eq("org_id", orgId).eq("checksum_sha256", checksum).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) { seeded.push(duplicate.id); continue; }
    const id = randomUUID();
    const path = `${orgId}/${productId}/${id}-${item.source}`;
    const metadata = await sharp(bytes).metadata();
    const { error: uploadError } = await supabase.storage.from("product-assets").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;
    const { error: assetError } = await supabase.from("product_assets").insert({
      id, org_id: orgId, product_id: productId, asset_type: item.type, storage_path: path, title: item.title,
      description: item.description, alt_text: item.alt, original_file_name: item.source, mime_type: "image/png",
      file_size_bytes: bytes.length, media_kind: "image", width_pixels: metadata.width, height_pixels: metadata.height,
      aspect_ratio: metadata.width && metadata.height ? metadata.width / metadata.height : null, checksum_sha256: checksum,
      category: item.category, tags: item.tags, approval_status: "processing", uploaded_by: user.id,
    });
    if (assetError) throw assetError;
    const { error: jobError } = await supabase.from("asset_media_jobs").insert({ org_id: orgId, asset_id: id, job_type: "image_derivatives", input: { source: "staging-demo", campaign: "nimbus-1" } });
    if (jobError) throw jobError;
    const { error: auditError } = await supabase.from("audit_log").insert({ org_id: orgId, actor_id: user.id, action: "product_asset.demo_seeded", entity_type: "product_asset", entity_id: id, detail: { title: item.title, source: "nimbus-staging-demo" } });
    if (auditError) throw auditError;
    seeded.push(id);
  }
  console.log(JSON.stringify({ productId, assetsSeeded: seeded.length, assetIds: seeded }, null, 2));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : JSON.stringify(error)); process.exitCode = 1; });
