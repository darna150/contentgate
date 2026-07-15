import { EmptyState } from "@/components/empty-state";
import { StudioWorkspace } from "./studio-workspace";
import type { StudioState } from "./studio-data";

export function StudioPageView({ state }: { state: StudioState }) {
  const {
    templates,
    selectedProduct,
    selectedTemplate,
    initialContents,
    initialSize,
    versionsBySize,
    canReview,
  } = state;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-6 py-9 sm:px-10">
      {selectedProduct && selectedTemplate ? (
        <StudioWorkspace
          key={selectedTemplate.id}
          templates={templates}
          selectedProduct={selectedProduct}
          selectedTemplate={selectedTemplate}
          initialContents={initialContents}
          initialSize={initialSize}
          versionsBySize={versionsBySize}
          canReview={canReview}
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
