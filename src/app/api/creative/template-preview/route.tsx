import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { SIZES, type SizeKey } from "@/lib/creative";
import { AssetLayout } from "@/lib/creative-layout";

export const runtime = "nodejs";

// Sample copy for template thumbnails — shows the locked design, not real content.
const SAMPLES: Record<string, string> = {
  headline: "Your approved headline",
  subheadline: "A supporting line from approved copy.",
  body: "Body copy generated from this product's approved sources appears here.",
  key_takeaway: "The one line worth remembering.",
  cta: "Talk to your rep",
  contact: "Contact your territory manager",
  territory: "Your region",
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

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
    .select("id, layout_key, editable_fields, product_id, products(name, disclaimer_text)")
    .eq("id", templateId)
    .single();
  if (!tpl) return new Response("Not found", { status: 404 });

  const product = Array.isArray(tpl.products) ? tpl.products[0] : tpl.products;
  const { data: claims } = await supabase
    .from("product_claims")
    .select("claim_text")
    .eq("product_id", tpl.product_id)
    .eq("status", "approved");
  const claimTexts = (claims ?? []).map((c) => c.claim_text);

  const editableFields = (tpl.editable_fields as string[]) ?? [];
  const fields: Record<string, string> = {};
  let benefitIdx = 0;
  for (const key of editableFields) {
    if (key.startsWith("benefit_")) {
      fields[key] = truncate(claimTexts[benefitIdx++] ?? "An approved product benefit.", 64);
    } else {
      fields[key] = SAMPLES[key] ?? "Sample";
    }
  }

  const { w, h } = size;
  return new ImageResponse(
    AssetLayout({
      layoutKey: tpl.layout_key,
      fields,
      orgName: product?.name ?? "Product",
      disclaimer: product?.disclaimer_text ?? "",
      w,
      h,
    }),
    { width: w, height: h }
  );
}
