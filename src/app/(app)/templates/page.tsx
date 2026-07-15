import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type FamilyRow = {
  id: string;
  name: string;
  family_key: string;
  status: string;
  created_at: string;
};

type VersionRow = {
  id: string;
  version_label: string;
  status: string;
  created_at: string;
  template_families: { name: string; family_key: string } | { name: string; family_key: string }[] | null;
};

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

type AssignmentRow = {
  id: string;
  status: string;
  default_variant_key: string | null;
  products: { name: string } | { name: string }[] | null;
  template_families: { name: string } | { name: string }[] | null;
  template_versions: { version_label: string } | { version_label: string }[] | null;
};

type ImportRunRow = {
  id: string;
  source_provider: string;
  status: string;
  manifest_sha256: string | null;
  report: { issues?: unknown[] } | null;
  created_at: string;
};

type RenderJobRow = {
  id: string;
  status: string;
  output_format: string;
  output_storage_path: string | null;
  created_at: string;
  completed_at: string | null;
  generated_content: { title: string } | { title: string }[] | null;
  template_variants: { variant_key: string; label: string } | { variant_key: string; label: string }[] | null;
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

function statusClass(status: string) {
  if (status === "published" || status === "active" || status === "completed" || status === "ready") {
    return "bg-approve-tint text-approve";
  }
  if (status === "failed" || status === "disabled") return "bg-reject-tint text-reject";
  return "bg-brand-tint text-brand";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-control border border-dashed border-edge-strong bg-page px-4 py-6 text-center text-[13px] text-ink-muted">
      {label}
    </div>
  );
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
    { data: versionRows },
    { data: variantRows },
    { data: assignmentRows },
    { data: importRunRows },
    { data: renderJobRows },
  ] = await Promise.all([
    supabase
      .from("template_families")
      .select("id, name, family_key, status, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("template_versions")
      .select("id, version_label, status, created_at, template_families(name, family_key)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("template_variants")
      .select("id, variant_key, label, width, height, template_versions(version_label, template_families(name))")
      .order("variant_key"),
    supabase
      .from("product_template_assignments")
      .select("id, status, default_variant_key, products(name), template_families(name), template_versions(version_label)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("template_import_runs")
      .select("id, source_provider, status, manifest_sha256, report, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("render_jobs")
      .select("id, status, output_format, output_storage_path, created_at, completed_at, generated_content(title), template_variants(variant_key, label)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const families = (familyRows ?? []) as FamilyRow[];
  const versions = (versionRows ?? []) as VersionRow[];
  const variants = (variantRows ?? []) as VariantRow[];
  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const importRuns = (importRunRows ?? []) as ImportRunRow[];
  const renderJobs = (renderJobRows ?? []) as RenderJobRow[];

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Template Ops</h1>
        <p className="text-[14.5px] text-ink-muted">
          Monitor published template bundles, product assignments, import runs,
          and server render jobs.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          ["Families", families.length],
          ["Versions", versions.length],
          ["Assignments", assignments.length],
          ["Recent renders", renderJobs.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-edge bg-surface p-5">
            <p className="text-[12px] font-semibold text-ink-muted">{label}</p>
            <p className="mt-1 font-serif text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-card border border-edge bg-surface p-5">
          <h2 className="text-[15px] font-bold">Template families</h2>
          <div className="mt-4 grid gap-2">
            {families.length ? families.map((family) => (
              <div key={family.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{family.name}</p>
                  <p className="text-[11.5px] text-ink-faint">{family.family_key}</p>
                </div>
                <StatusBadge status={family.status} />
              </div>
            )) : <EmptyRow label="No template families yet." />}
          </div>
        </div>

        <div className="rounded-card border border-edge bg-surface p-5">
          <h2 className="text-[15px] font-bold">Recent import runs</h2>
          <div className="mt-4 grid gap-2">
            {importRuns.length ? importRuns.map((run) => (
              <div key={run.id} className="rounded-control border border-edge bg-page px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-[13px] font-semibold capitalize">{run.source_provider}</p>
                  <StatusBadge status={run.status} />
                </div>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  {dateLabel(run.created_at)} · {(run.report?.issues ?? []).length} issues
                </p>
              </div>
            )) : <EmptyRow label="No import runs recorded." />}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-edge bg-surface p-5">
        <h2 className="text-[15px] font-bold">Published versions and variants</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="grid gap-2">
            {versions.length ? versions.map((version) => {
              const family = one(version.template_families);
              return (
                <div key={version.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{family?.name ?? "Template"} · {version.version_label}</p>
                    <p className="text-[11.5px] text-ink-faint">{dateLabel(version.created_at)}</p>
                  </div>
                  <StatusBadge status={version.status} />
                </div>
              );
            }) : <EmptyRow label="No template versions yet." />}
          </div>
          <div className="grid gap-2">
            {variants.length ? variants.map((variant) => {
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
            }) : <EmptyRow label="No template variants yet." />}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-card border border-edge bg-surface p-5">
          <h2 className="text-[15px] font-bold">Product assignments</h2>
          <div className="mt-4 grid gap-2">
            {assignments.length ? assignments.map((assignment) => {
              const product = one(assignment.products);
              const family = one(assignment.template_families);
              const version = one(assignment.template_versions);
              return (
                <div key={assignment.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{product?.name ?? "Product"} → {family?.name ?? "Template"}</p>
                    <p className="text-[11.5px] text-ink-faint">{version?.version_label ?? "version"} · default {assignment.default_variant_key ?? "—"}</p>
                  </div>
                  <StatusBadge status={assignment.status} />
                </div>
              );
            }) : <EmptyRow label="No product assignments yet." />}
          </div>
        </div>

        <div className="rounded-card border border-edge bg-surface p-5">
          <h2 className="text-[15px] font-bold">Recent render jobs</h2>
          <div className="mt-4 grid gap-2">
            {renderJobs.length ? renderJobs.map((job) => {
              const content = one(job.generated_content);
              const variant = one(job.template_variants);
              return (
                <div key={job.id} className="flex items-center gap-3 rounded-control border border-edge bg-page px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{content?.title ?? "Rendered content"}</p>
                    <p className="text-[11.5px] text-ink-faint">{variant?.label ?? variant?.variant_key ?? "variant"} · {job.output_format} · {dateLabel(job.completed_at ?? job.created_at)}</p>
                    {job.output_storage_path && (
                      <p className="truncate text-[10.5px] text-ink-faint">
                        Stored: {job.output_storage_path}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              );
            }) : <EmptyRow label="No server render jobs yet." />}
          </div>
        </div>
      </section>
    </div>
  );
}
