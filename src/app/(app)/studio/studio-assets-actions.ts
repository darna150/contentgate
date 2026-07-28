"use server";

import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { getTemplateVariantRenderAssetPaths } from "@/lib/template-platform/live-preview-assets";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";

export async function loadStudioVariantAssetUrls(input: {
  assignmentId: string;
  variantKey: string;
}) {
  const supabase = await createClient();
  const [
    { data: assignment },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("product_template_assignments")
      .select(
        "status, template_versions!product_template_assignments_template_version_id_fkey(status, manifest)"
      )
      .eq("id", input.assignmentId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = user
    ? await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle()
    : { data: null };

  const version = Array.isArray(assignment?.template_versions)
    ? assignment.template_versions[0]
    : assignment?.template_versions;
  const manifest = version?.status === "published" ? (version.manifest as TemplateBundleManifest) : null;
  if (!manifest || !profile?.org_id) {
    return { error: "This template is no longer available.", urls: {} };
  }

  const assetPaths = getTemplateVariantRenderAssetPaths(manifest, input.variantKey);
  if (!assetPaths.length) {
    return { error: "This template size could not be prepared.", urls: {} };
  }

  const urls = await createTemplateBundleAssetUrlMap(supabase, profile.org_id, [manifest], {
    assetPaths,
  });
  return { error: null, urls: Object.fromEntries(urls) };
}
