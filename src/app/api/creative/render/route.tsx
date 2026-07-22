import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateStoredContentEvidence } from "@/lib/evidence-lifecycle";
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
import { resolveTemplatePlatformVariantLayout } from "@/lib/template-platform/fit";
import { resolveTemplateBundleRuntimeVariant } from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import { loadTemplateBundleImageFonts } from "@/lib/template-platform/server-fonts";
import {
  convertServerRenderedPng,
  type ServerExportFormat,
} from "@/lib/server-export-formats";
import { renderOutputStoragePath } from "@/lib/render-output-storage";
import {
  isTemplateSizeAllowed,
  type TemplateSizeKey,
  usesRegisteredTemplateContract,
} from "@/lib/template-contract";
import { renderContractTemplate } from "@/lib/template-renderer";
import { canExportContent, type ContentStatus } from "@/lib/content-governance";

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
      .toLowerCase() || "content"
  );
}

function renderInputSha256(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

// Renders an org-visible piece of content into its product's locked layout.
export async function GET(req: Request) {
  try {
    return await renderContent(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[render] unhandled exception:", message, err);
    return new Response(`Render error: ${message}`, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

async function renderContent(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("content");
  const requestedSizeParam = searchParams.get("size");
  const requestedSize = requestedSizeParam ?? "square";
  const format = exportFormat(searchParams.get("format"));
  const scale = exportScale(searchParams.get("scale"));
  const download = searchParams.get("download") === "1";
  if (!contentId) return new Response("Missing content id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, org_id, product_id, status, current_revision_number, approved_revision_number, structured_fields, template_version_id, template_variant_id, renderer_version, products!generated_content_product_id_fkey(name, disclaimer_text), product_templates!generated_content_product_template_id_fkey(layout_key, category, template_definition, status), template_versions!generated_content_template_version_id_fkey(manifest), template_variants!generated_content_template_variant_id_fkey(variant_key)"
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
    const variantKey = platformVariant.variant_key;
    if (requestedSizeParam && requestedSizeParam !== variantKey) {
      return new Response("Rendered size must match the approved template size.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const runtime = resolveTemplateBundleRuntimeVariant(manifest, variantKey);
    if (!runtime) {
      return new Response("Unsupported size for this template", { status: 400 });
    }
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(supabase, [manifest])
    );
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
    if (!rendered) return new Response("Template render failed", { status: 500 });
    const fonts = await loadTemplateBundleImageFonts({ manifest, assetUrlByPath });
    const image = new ImageResponse(rendered.element, {
      width: rendered.width,
      height: rendered.height,
      fonts: fonts.length ? fonts : await loadContentGateFonts(),
      headers: cacheHeaders,
    });
    if (format === "png" && !download) return image;

    const converted = await convertServerRenderedPng({
      png: await image.arrayBuffer(),
      width: rendered.width,
      height: rendered.height,
      size: variantKey as SizeKey,
      format,
    });
    const filename = `${safeFilename(
      `${productName}-${variantKey}${scale > 1 ? `-${scale}x` : ""}`
    )}.${converted.extension}`;
    if (download) {
      const evidenceError = await validateStoredContentEvidence(
        supabase,
        content.id
      );
      if (evidenceError) {
        return new Response(evidenceError, {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
      const inputHash = renderInputSha256({
        contentId: content.id,
        fields,
        format,
        scale,
        variantKey,
        revision: content.current_revision_number,
      });
      const outputStoragePath = renderOutputStoragePath({
        orgId: content.org_id,
        contentId: content.id,
        revision: content.current_revision_number,
        variantKey,
        format,
        inputSha256: inputHash,
        extension: converted.extension,
      });
      const storageClient = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient()
        : supabase;
      const { error: uploadError } = await storageClient.storage
        .from("rendered-assets")
        .upload(outputStoragePath, Buffer.from(converted.body), {
          contentType: converted.contentType,
          cacheControl: "31536000",
          upsert: true,
        });
      if (uploadError) {
        return new Response(`Could not store rendered output: ${uploadError.message}`, {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        });
      }

      const renderPayload = {
        format,
        variant_key: variantKey,
        width: rendered.width,
        height: rendered.height,
        scale,
        surface: "creative_render",
        output_storage_path: outputStoragePath,
      };
      const renderDiagnostics = {
        source: "server_render_route",
        stored_output: true,
      };
      const { error: renderJobError } = await supabase.rpc("record_render_job_event", {
        p_content_id: content.id,
        p_output_format: format,
        p_input_sha256: inputHash,
        p_payload: renderPayload,
        p_diagnostics: renderDiagnostics,
      });
      if (renderJobError) {
        await storageClient.storage.from("rendered-assets").remove([outputStoragePath]);
        return new Response(`Could not record render job: ${renderJobError.message}`, {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
    }
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
  const sizeKey = requestedSize as TemplateSizeKey;
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
