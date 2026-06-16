import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { SIZES, type SizeKey } from "@/lib/creative";
import { AssetLayout } from "@/lib/creative-layout";
import { renderApexCanine } from "@/lib/apex-canine-render";
import { renderVitalBite } from "@/lib/vitalbite-render";
import { loadVitalBiteFonts } from "@/lib/vitalbite-fonts";
import { renderCaniGuard5 } from "@/lib/caniguard5-render";
import { loadCaniGuard5Fonts } from "@/lib/caniguard5-fonts";
import { loadApexCanineFonts } from "@/lib/apex-canine-fonts";
import { renderDigestPro } from "@/lib/digestpro-render";
import { loadDigestProFonts } from "@/lib/digestpro-fonts";
import { renderPoultryShieldPro } from "@/lib/poultryshieldpro-render";
import { loadPoultryShieldProFonts } from "@/lib/poultryshieldpro-fonts";
import { renderSwineGuardPlus } from "@/lib/swineguardplus-render";
import { loadSwineGuardPlusFonts } from "@/lib/swineguardplus-fonts";
import { renderTemplateSpec } from "@/lib/template-spec-render";

export const runtime = "nodejs";

// Sample copy for template thumbnails — shows the locked design, not real content.
const SAMPLES: Record<string, string> = {
  // Legacy layout fields
  headline: "Your approved headline",
  subheadline: "A supporting line from approved copy.",
  body: "Body copy generated from this product's approved sources appears here.",
  key_takeaway: "The one line worth remembering.",
  cta: "Talk to your rep",
  contact: "Contact your territory manager",
  territory: "Your region",
};

// Renders a template VARIANT's locked layout with placeholder copy (a preview).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("template");
  const sizeKey = (searchParams.get("size") ?? "square") as SizeKey;
  const size = SIZES[sizeKey] ?? SIZES.square;
  if (!templateId) return new Response("Missing template id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: tpl } = await supabase
    .from("product_templates")
    .select("id, variant, layout_key, editable_fields, default_copy, product_id, products(name, disclaimer_text)")
    .eq("id", templateId)
    .single();
  if (!tpl) return new Response("Not found", { status: 404 });

  const product = Array.isArray(tpl.products) ? tpl.products[0] : tpl.products;

  const layoutKey = tpl.layout_key as string;
  const productName = product?.name ?? "Product";
  const editableFields = (tpl.editable_fields as string[]) ?? [];
  const seededCopy = (tpl.default_copy ?? {}) as Record<string, string>;
  const VITALBITE_SAMPLES: Record<string, string> = {
    kicker: "Clinically tested dental wellness",
    headline: "Fresher breath.\nCleaner teeth.\nHappier dogs.",
    supporting: "Grain-free treats with natural ingredients for dogs of all sizes.",
    bullets: "Cleans Teeth & Reduces Plaque\nSupports Healthy Gums\nMade with Natural Ingredients\nLoved by Dogs. Trusted by Pet Parents.",
    cta: "Discover VitalBite",
    body: "VitalBite Dental Chews help support daily oral care with a grain-free, low-calorie formula made from natural ingredients.",
    benefits: "Reduces tartar buildup by up to 70%\nGrain-free, low-calorie formula\nNatural ingredients for all sizes",
    website: "vitalbite.com",
  };

  const fields: Record<string, string> = Object.keys(seededCopy).length
    ? { ...seededCopy }
    : layoutKey.startsWith("vitalbite_")
      ? { ...VITALBITE_SAMPLES }
      : {};
  for (const key of editableFields) {
    if (fields[key]) {
      continue;
    }
    fields[key] = SAMPLES[key] ?? "Sample";
  }
  const disclaimer = product?.disclaimer_text ?? "";
  if (layoutKey.startsWith("poultryshieldpro_")) {
    const specRender = renderTemplateSpec({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
      original: true,
    });
    const { element, w, h } =
      specRender ??
      renderPoultryShieldPro({
        sizeKey,
        fields,
        disclaimer,
        origin: new URL(req.url).origin,
        original: true,
      });
    const fonts = await loadPoultryShieldProFonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  if (layoutKey.startsWith("swineguardplus_")) {
    const specRender = renderTemplateSpec({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
      original: true,
    });
    const { element, w, h } =
      specRender ??
      renderSwineGuardPlus({
        sizeKey,
        fields,
        disclaimer,
        origin: new URL(req.url).origin,
        original: true,
      });
    const fonts = await loadSwineGuardPlusFonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  if (layoutKey.startsWith("digestpro_")) {
    const { element, w, h } = renderDigestPro({
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
      original: true,
    });
    const fonts = await loadDigestProFonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  if (layoutKey.startsWith("caniguard5_")) {
    const { element, w, h } = renderCaniGuard5({
      sizeKey,
      fields,
      disclaimer,
      origin: new URL(req.url).origin,
      original: true,
    });
    const fonts = await loadCaniGuard5Fonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  if (layoutKey.startsWith("vitalbite_")) {
    const origin = new URL(req.url).origin;
    const { element, w, h } = renderVitalBite({
      layoutKey,
      sizeKey,
      fields,
      disclaimer,
      origin,
      original: true,
    });
    const fonts = await loadVitalBiteFonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  if (layoutKey.startsWith("apex_canine_")) {
    const origin = new URL(req.url).origin;
    const { element, w, h } = renderApexCanine({
      sizeKey,
      fields,
      disclaimer,
      origin,
      original: true,
    });
    const fonts = await loadApexCanineFonts();
    return new ImageResponse(element, {
      width: w,
      height: h,
      fonts,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    });
  }

  const { w, h } = size;
  return new ImageResponse(
    AssetLayout({ layoutKey, fields, orgName: productName, disclaimer, w, h }),
    {
      width: w,
      height: h,
      headers: responseHeaders(searchParams.get("download"), tpl.variant),
    }
  );
}

function responseHeaders(download: string | null, variant: string): Record<string, string> {
  if (download === "1") {
    const filename =
      variant.replace(/[^\w\d-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
      "template";
    return { "Content-Disposition": `attachment; filename="${filename}-original.png"` };
  }
  return { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
}
