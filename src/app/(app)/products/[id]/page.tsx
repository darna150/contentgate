import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductWorkspace } from "@/lib/product-workspace-server";
import {
  parseWorkspaceView,
  WorkspaceTabs,
  type WorkspaceView,
} from "./_workspace/workspace-tabs";
import { ProductStatusBadge } from "./_workspace/product-status-badge";
import { AssetsView } from "./_workspace/assets-view";
import { KnowledgeView } from "./_workspace/knowledge-view";
import { TemplatesView } from "./_workspace/templates-view";
import { ContentView } from "./_workspace/content-view";
import { ApprovalsView } from "./_workspace/approvals-view";

export default async function ProductWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  const { view: viewParam } = await searchParams;
  const view = parseWorkspaceView(viewParam);
  const workspace = await getProductWorkspace(id, { view });
  if (!workspace) notFound();

  const { product, counts, permissions } = workspace;

  const tabCounts: Record<WorkspaceView, number> = {
    assets: counts.assets,
    knowledge: workspace.sections.knowledge.count,
    templates: counts.activeTemplates,
    content: counts.content,
    approvals: counts.inReview,
  };

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-9 sm:px-10">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/products"
          className="text-[13px] font-semibold text-brand hover:underline"
        >
          ← Products
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-brand-dark text-[15px] font-bold text-white">
            {product.name[0]}
          </span>
          <h1 className="min-w-0 font-serif text-[26px] font-semibold sm:text-[28px]">
            {product.name}
          </h1>
          <ProductStatusBadge status={product.status} />
          <div className="flex-1" />
          {permissions.canEditProduct && (
            <Link
              href={`/products/${id}/edit`}
              className="flex-shrink-0 rounded-control border border-edge px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand"
            >
              Edit product
            </Link>
          )}
        </div>
        {product.description && (
          <p className="max-w-2xl text-[14.5px] text-ink-muted">
            {product.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <WorkspaceTabs productId={id} active={view} counts={tabCounts} />

      {/* Active view */}
      <div>
        {view === "assets" && <AssetsView workspace={workspace} />}
        {view === "knowledge" && <KnowledgeView workspace={workspace} />}
        {view === "templates" && <TemplatesView workspace={workspace} />}
        {view === "content" && <ContentView workspace={workspace} />}
        {view === "approvals" && <ApprovalsView workspace={workspace} />}
      </div>
    </div>
  );
}
