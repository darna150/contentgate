/**
 * Run in a long-lived Node container with FFmpeg/FFprobe installed:
 *   npx tsx scripts/process-asset-media.ts
 *
 * The worker uses the server-only service key. Do not run it in a browser or
 * expose its environment to a client bundle.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const workerId = process.env.MEDIA_WORKER_ID ?? `asset-media-${process.pid}`;

async function heartbeat(status: "healthy" | "degraded" = "healthy") {
  const { error } = await supabase.from("asset_media_worker_heartbeats").upsert({
    worker_id: workerId,
    last_seen_at: new Date().toISOString(),
    status,
  });
  if (error) throw error;
}

function derivedPath(storagePath: string, suffix: string) {
  return storagePath.replace(/\.[a-z0-9]+$/i, suffix);
}

async function upload(path: string, bytes: Buffer, contentType: string) {
  const { error } = await supabase.storage.from("product-assets").upload(path, bytes, {
    contentType,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw error;
}

async function processJob(job: Record<string, unknown>) {
  const assetId = String(job.asset_id);
  const { data: asset, error } = await supabase
    .from("product_assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .single();
  if (error || !asset) throw error ?? new Error("Asset no longer exists.");
  const { data: source, error: downloadError } = await supabase.storage.from("product-assets").download(asset.storage_path);
  if (downloadError || !source) throw downloadError ?? new Error("Could not download source media.");

  const jobType = String(job.job_type);
  if (jobType === "document_metadata") return;
  if (jobType === "image_derivatives") {
    const outputPath = derivedPath(asset.storage_path, "-preview.webp");
    const bytes = Buffer.from(await source.arrayBuffer());
    await upload(outputPath, await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(), "image/webp");
    const { error: updateError } = await supabase.from("product_assets").update({ preview_storage_path: outputPath }).eq("id", asset.id);
    if (updateError) throw updateError;
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), "contentgate-media-"));
  const input = join(dir, "source");
  await writeFile(input, Buffer.from(await source.arrayBuffer()));
  try {
    if (jobType === "video_probe") {
      const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", input]);
      const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ width?: number; height?: number }> };
      const stream = probe.streams?.find((item) => item.width && item.height);
      const width = stream?.width ?? null;
      const height = stream?.height ?? null;
      const { error: updateError } = await supabase.from("product_assets").update({ width_pixels: width, height_pixels: height, duration_seconds: Number(probe.format?.duration ?? 0) || null, aspect_ratio: width && height ? Math.round((width / height) * 1_000_000) / 1_000_000 : null }).eq("id", asset.id);
      if (updateError) throw updateError;
    } else if (jobType === "video_poster") {
      const output = join(dir, "poster.jpg");
      await execFileAsync("ffmpeg", ["-y", "-ss", "0.2", "-i", input, "-frames:v", "1", "-vf", "thumbnail,scale=1280:-2", "-q:v", "3", output]);
      const outputPath = derivedPath(asset.storage_path, "-poster.jpg");
      await upload(outputPath, await readFile(output), "image/jpeg");
      const { error: updateError } = await supabase.from("product_assets").update({ poster_storage_path: outputPath }).eq("id", asset.id);
      if (updateError) throw updateError;
    } else if (jobType === "video_transcode") {
      const output = join(dir, "preview.mp4");
      await execFileAsync("ffmpeg", ["-y", "-i", input, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", output]);
      const outputPath = derivedPath(asset.storage_path, "-preview.mp4");
      await upload(outputPath, await readFile(output), "video/mp4");
      const { error: updateError } = await supabase.from("product_assets").update({ transcoded_storage_path: outputPath }).eq("id", asset.id);
      if (updateError) throw updateError;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function run() {
  for (;;) {
    await heartbeat();
    const { data, error } = await supabase.rpc("claim_asset_media_job", { p_worker_id: workerId });
    if (error) throw error;
    const job = Array.isArray(data) ? data[0] : data;
    if (!job || !job.id) { await new Promise((resolve) => setTimeout(resolve, 2_000)); continue; }
    try {
      await processJob(job as Record<string, unknown>);
      const { error: completeError } = await supabase.from("asset_media_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
      if (completeError) throw completeError;
      const { data: remaining, error: remainingError } = await supabase.from("asset_media_jobs").select("id").eq("asset_id", job.asset_id).in("status", ["queued", "running"]).limit(1);
      if (remainingError) throw remainingError;
      if (!remaining?.length) {
        const { data: asset, error: assetError } = await supabase
          .from("product_assets")
          .select("id, org_id, storage_path, preview_storage_path, poster_storage_path, transcoded_storage_path, mime_type, file_size_bytes, checksum_sha256, uploaded_by")
          .eq("id", job.asset_id)
          .single();
        if (assetError || !asset) throw assetError ?? new Error("Asset disappeared before publication.");
        const { data: latest, error: latestError } = await supabase
          .from("product_asset_versions")
          .select("version_number")
          .eq("asset_id", asset.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) throw latestError;
        const { data: version, error: versionError } = await supabase
          .from("product_asset_versions")
          .insert({
            org_id: asset.org_id,
            asset_id: asset.id,
            version_number: (latest?.version_number ?? 0) + 1,
            storage_path: asset.storage_path,
            preview_storage_path: asset.preview_storage_path,
            poster_storage_path: asset.poster_storage_path,
            transcoded_storage_path: asset.transcoded_storage_path,
            mime_type: asset.mime_type,
            file_size_bytes: asset.file_size_bytes,
            checksum_sha256: asset.checksum_sha256,
            created_by: asset.uploaded_by,
          })
          .select("id")
          .single();
        if (versionError || !version) throw versionError ?? new Error("Could not create immutable asset version.");
        const { error: publishError } = await supabase
          .from("product_assets")
          .update({ approval_status: "approved", current_version_id: version.id })
          .eq("id", job.asset_id)
          .eq("approval_status", "processing");
        if (publishError) throw publishError;
      }
    } catch (error) {
      await heartbeat("degraded");
      const attempts = Number(job.attempt_count ?? 1);
      const terminal = attempts >= Number(job.max_attempts ?? 3);
      await supabase.from("asset_media_jobs").update({ status: terminal ? "failed" : "queued", run_after: new Date(Date.now() + attempts * 30_000).toISOString(), error_message: error instanceof Error ? error.message.slice(0, 1000) : "Media processing failed." }).eq("id", job.id);
      if (terminal) {
        await supabase.from("product_assets").update({ approval_status: "rejected" }).eq("id", job.asset_id).eq("approval_status", "processing");
      }
    }
  }
}

void run();
