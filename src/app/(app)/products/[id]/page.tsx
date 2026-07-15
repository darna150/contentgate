import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getProductWorkspace } from "@/lib/product-workspace-server";
import {
  parseWorkspaceView,
  WorkspaceTabs,
  type WorkspaceView,
} from "./_workspace/workspace-tabs";
import { ProductStatusBadge } from "./_workspace/product-status-badge";
import { OverviewView } from "./_workspace/overview-view";
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

  const tabCounts: Partial<Record<WorkspaceView, number>> = {
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
          className="text-label text-brand hover:underline"
        >
          ← Products
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-brand-dark text-[15px] font-bold text-white">
            {product.name[0]}
          </span>
          <h1 className="min-w-0 text-h1 text-ink">{product.name}</h1>
          <ProductStatusBadge status={product.status} />
          <div className="flex-1" />
          {permissions.canEditProduct && (
            <Button asChild variant="outline" size="sm" className="flex-shrink-0">
              <Link href={`/products/${id}/edit`}>Edit product</Link>
            </Button>
          )}
        </div>
        {product.description && (
          <p className="max-w-2xl text-body text-ink-muted">{product.description}</p>
        )}
      </div>

      {/* Tabs */}
      <WorkspaceTabs productId={id} active={view} counts={tabCounts} />

      {/* Active view */}
      <div>
        {view === "overview" && <OverviewView workspace={workspace} />}
        {view === "assets" && <AssetsView workspace={workspace} />}
        {view === "knowledge" && <KnowledgeView workspace={workspace} />}
        {view === "templates" && <TemplatesView workspace={workspace} />}
        {view === "content" && <ContentView workspace={workspace} />}
        {view === "approvals" && <ApprovalsView workspace={workspace} />}
      </div>
    </div>
  );
}
