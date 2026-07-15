import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProductTemplateAssignmentsPage,
  getTemplateExportHistory,
  getTemplateImportRunsPage,
  getTemplateVersionsPage,
  type ProductTemplateAssignmentListRow,
  type TemplateExportHistoryItem,
  type TemplateImportRunListRow,
  type TemplateVersionListRow,
} from "@/lib/template-ops-server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import {
  AssignTemplatePanel,
  ImportBundlePanel,
  PublishVersionButton,
} from "./template-ops-actions";

type FamilyRow = {
  id: string;
  name: string;
  family_key: string;
  status: string;
  created_at: string;
};

type VersionRow = TemplateVersionListRow;

type VariantRow = {
  id: string;
  variant_key: string;
  label: string;
  width: number;
  height: number;
  template_versions: {
    version_label: string;
    template_families: { name: string } | { name: string }[] | null;
  } | {
    version_label: string;
    template_families: { name: string } | { name: string }[] | null;
  }[] | null;
};

type AssignmentRow = ProductTemplateAssignmentListRow;

type ImportRunRow = TemplateImportRunListRow;

type ProductRow = {
  id: string;
  name: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Template Ops has several independent status vocabularies (see
// supabase/migrations/20260714183000_template_platform_v1_foundation.sql for
// the check constraints). None of them match generated_content's
// draft/in_review/approved/rejected vocabulary that StatusPill covers, so each
// gets its own status -> Badge variant mapping here, following the same
// pattern as ProductStatusBadge and documentIndexStatusClass.
const FAMILY_STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "neutral",
  active: "approve",
  retired: "neutral",
};

const VERSION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "neutral",
  validating: "warn",
  ready: "brand",
  published: "approve",
  retired: "neutral",
};

const ASSIGNMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "approve",
  paused: "warn",
  retired: "neutral",
};

const IMPORT_RUN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  received: "neutral",
  validating: "warn",
  failed: "reject",
  ready: "brand",
  published: "approve",
};

const RENDER_JOB_STATUS_VARIANT: Record<string, BadgeVariant> = {
  queued: "neutral",
  running: "warn",
  failed: "reject",
  completed: "approve",
};

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function StatusBadge({
  status,
  variants,
}: {
  status: string;
  variants: Record<string, BadgeVariant>;
}) {
  return <Badge variant={variants[status] ?? "neutral"}>{formatStatusLabel(status)}</Badge>;
}

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [
    { data: familyRows },
    versionPage,
    { data: variantRows },
    assignmentPage,
    importRunPage,
    renderJobPage,
    { data: productRows },
  ] = await Promise.all([
    supabase
      .from("template_families")
      .select("id, name, family_key, status, created_at")
      .order("created_at", { ascending: false }),
    getTemplateVersionsPage({ pageSize: 10 }),
    supabase
      .from("template_variants")
      .select("id, variant_key, label, width, height, template_versions(version_label, template_families(name))")
      .order("variant_key"),
    getProductTemplateAssignmentsPage({ pageSize: 20 }),
    getTemplateImportRunsPage({ pageSize: 8 }),
    getTemplateExportHistory({ limit: 8 }),
    supabase
      .from("products")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  const families = (familyRows ?? []) as FamilyRow[];
  const versions = versionPage.rows as VersionRow[];
  const variants = (variantRows ?? []) as VariantRow[];
  const assignments = assignmentPage.rows as AssignmentRow[];
  const importRuns = importRunPage.rows as ImportRunRow[];
  const renderJobs = renderJobPage.rows as TemplateExportHistoryItem[];
  const products = (productRows ?? []) as ProductRow[];
  const versionOptions = versions
    .filter((version) => version.manifest)
    .map((version) => {
      const family = one(version.template_families);
      return {
        id: version.id,
        familyName: family?.name ?? "Template",
        versionLabel: version.version_label,
        status: version.status,
        variants: (version.manifest?.variants ?? []).map((variant) => ({
          key: variant.key,
          label: variant.label,
          width: variant.width,
          height: variant.height,
        })),
      };
    });

  const stats = [
    ["Families", families.length],
    ["Versions", versions.length],
    ["Assignments", assignments.length],
    ["Recent renders", renderJobs.length],
  ] as const;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 py-9">
      <PageHeader
        title="Template Ops"
        description="Monitor published template bundles, product assignments, import runs, and server render jobs."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-4">
            <span className="text-[22px] font-bold text-ink">{value}</span>
            <span className="text-[11.5px] font-semibold text-ink-faint">{label}</span>
          </div>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <ImportBundlePanel />
        <AssignTemplatePanel products={products} versions={versionOptions} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Template families</CardTitle>
          </CardHeader>
          <CardContent>
            {families.length ? (
              <div className="grid gap-2">
                {families.map((family) => (
                  <div key={family.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{family.name}</p>
                      <p className="text-[11.5px] text-ink-faint">{family.family_key}</p>
                    </div>
                    <StatusBadge status={family.status} variants={FAMILY_STATUS_VARIANT} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState className="py-8" title="No template families yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent import runs</CardTitle>
          </CardHeader>
          <CardContent>
            {importRuns.length ? (
              <div className="grid gap-2">
                {importRuns.map((run) => (
                  <div key={run.id} className="rounded-control border border-edge bg-page px-4 py-3">
                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-[13px] font-semibold capitalize">{run.source_provider}</p>
                      <StatusBadge status={run.status} variants={IMPORT_RUN_STATUS_VARIANT} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {dateLabel(run.created_at)} · {(run.report?.issues ?? []).length} issues
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState className="py-8" title="No import runs recorded" />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Published versions and variants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-label text-ink-faint">Versions</p>
              {versions.length ? (
                <div className="grid gap-2">
                  {versions.map((version) => {
                    const family = one(version.template_families);
                    return (
                      <div key={version.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{family?.name ?? "Template"} · {version.version_label}</p>
                          <p className="text-[11.5px] text-ink-faint">{dateLabel(version.created_at)}</p>
                        </div>
                        <StatusBadge status={version.status} variants={VERSION_STATUS_VARIANT} />
                        <PublishVersionButton versionId={version.id} status={version.status} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState className="py-8" title="No template versions yet" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-label text-ink-faint">Variants</p>
              {variants.length ? (
                <div className="grid gap-2">
                  {variants.map((variant) => {
                    const version = one(variant.template_versions);
                    const family = one(version?.template_families);
                    return (
                      <div key={variant.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{family?.name ?? "Template"} · {variant.label}</p>
                          <p className="text-[11.5px] text-ink-faint">{variant.variant_key} · {variant.width} × {variant.height}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState className="py-8" title="No template variants yet" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length ? (
              <div className="grid gap-2">
                {assignments.map((assignment) => {
                  const product = one(assignment.products);
                  const family = one(assignment.template_families);
                  const version = one(assignment.template_versions);
                  return (
                    <div key={assignment.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{product?.name ?? "Product"} → {family?.name ?? "Template"}</p>
                        <p className="text-[11.5px] text-ink-faint">{version?.version_label ?? "version"} · default {assignment.default_variant_key ?? "—"}</p>
                      </div>
                      <StatusBadge status={assignment.status} variants={ASSIGNMENT_STATUS_VARIANT} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState className="py-8" title="No product assignments yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent render jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {renderJobs.length ? (
              <div className="grid gap-2">
                {renderJobs.map((job) => (
                  <div key={job.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{job.contentTitle ?? "Rendered content"}</p>
                      <p className="text-[11.5px] text-ink-faint">
                        {job.variantLabel ?? job.variantKey ?? "variant"} · {job.outputFormat}
                        {job.exportedByName ? ` · ${job.exportedByName}` : ""} ·{" "}
                        {dateLabel(job.completedAt ?? job.createdAt)}
                      </p>
                      {job.outputStoragePath && (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-[10.5px] text-ink-faint">
                            Stored: {job.outputStoragePath}
                          </p>
                          <a
                            href={`/api/creative/render-jobs/${job.id}`}
                            className="shrink-0 text-[10.5px] font-semibold text-brand hover:underline"
                          >
                            Open
                          </a>
                        </div>
                      )}
                    </div>
                    <StatusBadge status={job.status} variants={RENDER_JOB_STATUS_VARIANT} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState className="py-8" title="No server render jobs yet" />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
