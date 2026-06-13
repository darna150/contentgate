import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { SIZES, type SizeKey } from "@/lib/creative";
import { AssetLayout } from "@/lib/creative-layout";

export const runtime = "nodejs";

// Renders an APPROVED piece of content into its product's locked layout.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("content");
  const sizeKey = (searchParams.get("size") ?? "square") as SizeKey;
  const size = SIZES[sizeKey] ?? SIZES.square;
  if (!contentId) return new Response("Missing content id", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, status, structured_fields, products(name, disclaimer_text), product_templates(layout_key, category)"
    )
    .eq("id", contentId)
    .single();
  if (!content) return new Response("Not found", { status: 404 });
  // Export gate: only approved content can be rendered to an asset.
  if (content.status !== "approved") {
    return new Response("Only approved content can be exported.", { status: 403 });
  }

  const product = Array.isArray(content.products) ? content.products[0] : content.products;
  const tpl = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;

  const { w, h } = size;
  return new ImageResponse(
    AssetLayout({
      layoutKey: tpl?.layout_key ?? "social_v1",
      fields: (content.structured_fields ?? {}) as Record<string, string>,
      orgName: product?.name ?? "Product",
      disclaimer: product?.disclaimer_text ?? "",
      w,
      h,
    }),
    { width: w, height: h }
  );
}
