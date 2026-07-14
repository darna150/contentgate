import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { renderTemplateBundleVariant } from "@/lib/template-platform/render";
import { resolveTemplateBundleRuntimeVariant } from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import { loadTemplateBundleImageFonts } from "@/lib/template-platform/server-fonts";
import { loadContentGateFonts } from "@/lib/contentgate-fonts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("content");
  const requestedSizeParam = searchParams.get("size");
  if (!contentId) return new Response("Missing content id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, structured_fields, template_versions(manifest), template_variants(variant_key)"
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
  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey,
    fields: (content.structured_fields ?? {}) as Record<string, string>,
    assetOrigin: new URL(req.url).origin,
    assetUrlByPath,
  });
  if (!rendered) return new Response("Template render failed.", { status: 500 });

  const fonts = await loadTemplateBundleImageFonts({ manifest, assetUrlByPath });
  return new ImageResponse(rendered.element, {
    width: rendered.width,
    height: rendered.height,
    fonts: fonts.length ? fonts : await loadContentGateFonts(),
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
