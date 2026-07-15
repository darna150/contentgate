import { StudioEditor } from "./studio-editor";
import type { StudioState } from "./studio-data";

export function StudioPageView({ state }: { state: StudioState }) {
  const {
    products,
    templates,
    selectedProduct,
    selectedTemplate,
    initialContents,
    initialSize,
    organizationName,
  } = state;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Creative Studio</h1>
        <p className="text-[14.5px] text-ink-muted">
          Choose a product and approved template, compare its original copy, and
          generate a fitted variation inside the locked design.
        </p>
      </div>
      {selectedProduct && selectedTemplate ? (
        <StudioEditor
          key={selectedTemplate.id}
          products={products}
          templates={templates}
          selectedProduct={selectedProduct}
          selectedTemplate={selectedTemplate}
          initialContents={initialContents}
          initialSize={initialSize}
          organizationName={organizationName}
        />
      ) : (
        <div className="rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center text-sm text-ink-muted">
          Add an active product and template to begin using Studio.
        </div>
      )}
    </div>
  );
}
