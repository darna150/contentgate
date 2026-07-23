import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { renderTemplateBundleVariant } from "@/lib/template-platform/render";
import { resolveTemplatePlatformVariantLayout } from "@/lib/template-platform/fit";
import { resolveTemplateBundleRuntimeVariant } from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import { loadTemplateBundleImageFonts } from "@/lib/template-platform/server-fonts";
import { loadContentGateFonts } from "@/lib/contentgate-fonts";
import {
  convertServerRenderedPng,
  type ServerExportFormat,
} from "@/lib/server-export-formats";

export const runtime = "nodejs";

function exportFormat(value: string | null): ServerExportFormat {
  return value === "jpeg" || value === "pdf" ? value : "png";
}

function exportScale(value: string | null): 1 | 2 {
  return value === "2" || value === "2x" ? 2 : 1;
}

function safeFilename(value: string) {
  return (
    value
      .replace(/[^\w\d-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "draft-preview"
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("content");
  const requestedSizeParam = searchParams.get("size");
  const format = exportFormat(searchParams.get("format"));
  const scale = exportScale(searchParams.get("scale"));
  const download = searchParams.get("download") === "1";
  if (!contentId) return new Response("Missing content id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (download) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return new Response("Draft preview downloads are available to admins only.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, title, structured_fields, template_versions(manifest), template_variants(variant_key), products!generated_content_product_id_fkey(name)"
    )
    .eq("id", contentId)
    .single();
  if (!content) return new Response("Not found", { status: 404 });

  const platformVersion = Array.isArray(content.template_versions)
    ? content.template_versions[0]
    : content.template_versions;
  const platformVariant = Array.isArray(content.template_variants)
    ? content.template_variants[0]
    : content.template_variants;
  if (!platformVersion?.manifest || !platformVariant?.variant_key) {
    return new Response("Template preview is unavailable for this content.", {
      status: 410,
    });
  }

  const variantKey = platformVariant.variant_key;
  if (requestedSizeParam && requestedSizeParam !== variantKey) {
    return new Response("Preview size must match the draft template size.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const manifest = platformVersion.manifest as TemplateBundleManifest;
  const runtimeVariant = resolveTemplateBundleRuntimeVariant(manifest, variantKey);
  if (!runtimeVariant) {
    return new Response("Unsupported size for this template.", { status: 400 });
  }

  const assetUrlByPath = Object.fromEntries(
    await createTemplateBundleAssetUrlMap(supabase, [manifest])
  );
  const fields = (content.structured_fields ?? {}) as Record<string, string>;
  const textLayoutByField = await resolveTemplatePlatformVariantLayout({
    manifest,
    variantKey,
    fields,
    assetUrlByPath,
  });
  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey,
    fields,
    assetOrigin: new URL(req.url).origin,
    assetUrlByPath,
    textLayoutByField,
    scale,
  });
  if (!rendered) return new Response("Template render failed.", { status: 500 });

  const fonts = await loadTemplateBundleImageFonts({ manifest, assetUrlByPath });
  const image = new ImageResponse(rendered.element, {
    width: rendered.width,
    height: rendered.height,
    fonts: fonts.length ? fonts : await loadContentGateFonts(),
    headers: {
      "Cache-Control": "no-store",
    },
  });
  if (format === "png" && !download) return image;

  const converted = await convertServerRenderedPng({
    png: await image.arrayBuffer(),
    width: rendered.width,
    height: rendered.height,
    size: variantKey,
    format,
  });
  const product = Array.isArray(content.products) ? content.products[0] : content.products;
  const filename = `${safeFilename(
    `${product?.name ?? content.title}-${variantKey}-draft-preview${
      scale > 1 ? `-${scale}x` : ""
    }`
  )}.${converted.extension}`;
  return new Response(Buffer.from(converted.body), {
    headers: {
      "Content-Type": converted.contentType,
      "Content-Disposition": download
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
