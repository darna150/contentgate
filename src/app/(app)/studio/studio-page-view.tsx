import { EmptyState } from "@/components/empty-state";
import { StudioWorkspace } from "./studio-workspace";
import type { StudioState } from "./studio-data";

export function StudioPageView({ state }: { state: StudioState }) {
  const {
    selectedProduct,
    selectedTemplate,
    initialContents,
    initialSize,
    versionsBySize,
    canReview,
    canDownloadDraftPreviews,
  } = state;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      {selectedProduct && selectedTemplate ? (
        <StudioWorkspace
          key={`${selectedTemplate.id}:${initialSize ?? "new"}:${initialContents
            .map((content) => content.id)
            .join(",")}`}
          selectedProduct={selectedProduct}
          selectedTemplate={selectedTemplate}
          initialContents={initialContents}
          initialSize={initialSize}
          versionsBySize={versionsBySize}
          canReview={canReview}
          canDownloadDraftPreviews={canDownloadDraftPreviews}
        />
      ) : (
        <EmptyState
          title="Nothing to generate yet"
          description="Add an active product and an approved template before Studio can generate anything."
          action={{ label: "Go to products", href: "/products" }}
        />
      )}
    </div>
  );
}
