import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { SIZES, type SizeKey } from "@/lib/creative";
import { AssetLayout } from "@/lib/creative-layout";
import {
  isApexCanineSizeAllowed,
  renderApexCanine,
} from "@/lib/apex-canine-render";
import { loadApexCanineFonts } from "@/lib/apex-canine-fonts";
import { renderVitalBite } from "@/lib/vitalbite-render";
import { loadVitalBiteFonts } from "@/lib/vitalbite-fonts";
import { renderCaniGuard5 } from "@/lib/caniguard5-render";
import { loadCaniGuard5Fonts } from "@/lib/caniguard5-fonts";
import { renderDigestPro } from "@/lib/digestpro-render";
import { loadDigestProFonts } from "@/lib/digestpro-fonts";
import { renderPoultryShieldPro } from "@/lib/poultryshieldpro-render";
import { loadPoultryShieldProFonts } from "@/lib/poultryshieldpro-fonts";
import { renderSwineGuardPlus } from "@/lib/swineguardplus-render";
import { loadSwineGuardPlusFonts } from "@/lib/swineguardplus-fonts";
import { renderTemplateSpec } from "@/lib/template-spec-render";
import { loadContentGateFonts } from "@/lib/contentgate-fonts";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { renderTemplateBundleVariant } from "@/lib/template-platform/render";
import { resolveTemplateBundleRuntimeVariant } from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import {
  isTemplateSizeAllowed,
  usesRegisteredTemplateContract,
} from "@/lib/template-contract";
import { renderContractTemplate } from "@/lib/template-renderer";
import { canExportContent, type ContentStatus } from "@/lib/content-governance";

export const runtime = "nodejs";

// Renders an org-visible piece of content into its product's locked layout.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("content");
  const requestedSize = searchParams.get("size") ?? "square";
  if (!contentId) return new Response("Missing content id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, status, current_revision_number, approved_revision_number, structured_fields, products(name, disclaimer_text), product_templates(layout_key, category, template_definition, status), template_versions(manifest), template_variants(variant_key)"
    )
    .eq("id", contentId)
    .single();
  if (!content) return new Response("Not found", { status: 404 });
  if (!canExportContent({
    status: content.status as ContentStatus,
    currentRevision: content.current_revision_number,
    approvedRevision: content.approved_revision_number,
  })) {
    return new Response("Only the currently approved revision can be rendered.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const product = Array.isArray(content.products) ? content.products[0] : content.products;
  const tpl = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const platformVersion = Array.isArray(content.template_versions)
    ? content.template_versions[0]
    : content.template_versions;
  const platformVariant = Array.isArray(content.template_variants)
    ? content.template_variants[0]
    : content.template_variants;

  const fields = (content.structured_fields ?? {}) as Record<string, string>;
  const productName = product?.name ?? "Product";
  const disclaimer = product?.disclaimer_text ?? "";

  const cacheHeaders = { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" };

  if (platformVersion?.manifest && platformVariant?.variant_key) {
    const manifest = platformVersion.manifest as TemplateBundleManifest;
    const variantKey = requestedSize === "square" ? platformVariant.variant_key : requestedSize;
    const runtime = resolveTemplateBundleRuntimeVariant(manifest, variantKey);
    if (!runtime) {
      return new Response("Unsupported size for this template", { status: 400 });
    }
    const rendered = renderTemplateBundleVariant({
      manifest,
      variantKey,
      fields,
      assetUrlByPath: Object.fromEntries(
        await createTemplateBundleAssetUrlMap(supabase, [manifest])
      ),
    });
    if (!rendered) return new Response("Template render failed", { status: 500 });
    const fonts = await loadContentGateFonts();
    return new ImageResponse(rendered.element, {
      width: rendered.width,
      height: rendered.height,
      fonts,
      headers: cacheHeaders,
    });
  }

  const layoutKey = tpl?.layout_key ?? "social_v1";
  const templateSizeInput = {
    layoutKey,
    category: tpl?.category ?? "social",
    definition: tpl?.template_definition,
    status: tpl?.status,
  };
  if (!isTemplateSizeAllowed(templateSizeInput, requestedSize)) {
    return new Response("Unsupported size for this template", { status: 400 });
  }
  const sizeKey = requestedSize as SizeKey;
  const size = SIZES[sizeKey];

  const contractRender = usesRegisteredTemplateContract(templateSizeInput)
    ? await renderContractTemplate({
        layoutKey,
        sizeKey,
        fields,
        disclaimer,
        origin: new URL(req.url).origin,
        definition: tpl?.template_definition,
      })
    : null;
  if (contractRender) {
    return new ImageResponse(contractRender.element, {
      width: contractRender.w,
      height: contractRender.h,
      fonts: contractRender.fonts,
      headers: cacheHeaders,
    });
  }

  if (layoutKey.startsWith("digestpro_")) {
    const { element, w, h } = renderDigestPro({
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
    });
    const fonts = await loadDigestProFonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  if (layoutKey.startsWith("apex_canine_")) {
    if (!isApexCanineSizeAllowed(layoutKey, sizeKey)) {
      return new Response("Unsupported size for this template", { status: 400 });
    }
    const origin = new URL(req.url).origin;
    const { element, w, h } = renderApexCanine({
      sizeKey,
      fields,
      disclaimer,
      origin,
    });
    const fonts = await loadApexCanineFonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  if (layoutKey.startsWith("caniguard5_")) {
    const { element, w, h } = renderCaniGuard5({
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
    });
    const fonts = await loadCaniGuard5Fonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  if (layoutKey.startsWith("poultryshieldpro_")) {
    const specRender = renderTemplateSpec({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
    });
    const { element, w, h } =
      specRender ??
      renderPoultryShieldPro({
        sizeKey,
        fields,
        disclaimer,
        origin: new URL(req.url).origin,
      });
    const fonts = await loadPoultryShieldProFonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  if (layoutKey.startsWith("swineguardplus_")) {
    const specRender = renderTemplateSpec({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
    });
    const { element, w, h } =
      specRender ??
      renderSwineGuardPlus({
        sizeKey,
        fields,
        disclaimer,
        origin: new URL(req.url).origin,
      });
    const fonts = await loadSwineGuardPlusFonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  if (layoutKey.startsWith("vitalbite_")) {
    const origin = new URL(req.url).origin;
    const { element, w, h } = renderVitalBite({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin,
    });
    const fonts = await loadVitalBiteFonts();
    return new ImageResponse(element, { width: w, height: h, fonts, headers: cacheHeaders });
  }

  const { w, h } = size;
  return new ImageResponse(
    AssetLayout({ layoutKey, fields, orgName: productName, disclaimer, w, h }),
    { width: w, height: h, headers: cacheHeaders }
  );
}
