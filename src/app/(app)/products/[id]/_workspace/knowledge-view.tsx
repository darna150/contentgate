import Link from "next/link";
import type { ProductWorkspace } from "@/lib/product-workspace-server";
import { SectionEmpty } from "./empty-state";

export function KnowledgeView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, approvedSources, claims, permissions, sections } = workspace;
  const approvedClaims = claims.filter((claim) => claim.status === "approved");
  const canManage = permissions.canManageKnowledge;

  if (sections.knowledge.isEmpty) {
    return (
      <SectionEmpty
        code="add_approved_knowledge"
        actionHref={canManage ? `/knowledge/new?product=${product.id}` : null}
        actionLabel={canManage ? "Add a source document" : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-[5px] bg-approve-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-approve">
          Locked knowledge
        </span>
        <Link href="/ask" className="text-[13px] font-semibold text-brand hover:underline">
          Open Knowledge Hub →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Source documents */}
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">Source documents</h2>
            {canManage && (
              <Link
                href={`/knowledge/new?product=${product.id}`}
                className="text-[12.5px] font-semibold text-brand hover:underline"
              >
                + Add
              </Link>
            )}
          </div>
          {approvedSources.length === 0 ? (
            <p className="text-[13px] text-ink-faint">None yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-edge">
              {approvedSources.map((doc) => (
                <li key={doc.id} className="py-2 first:pt-0 last:pb-0">
                  <Link
                    href={`/knowledge/${doc.id}`}
                    className="flex items-center gap-2 text-[13.5px] font-medium text-ink hover:text-brand"
                  >
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                    {doc.fileType && (
                      <span className="flex-shrink-0 rounded-[5px] bg-page px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-faint">
                        {doc.fileType}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Approved claims */}
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">
              Approved claims ({approvedClaims.length})
            </h2>
            {canManage && (
              <Link
                href={`/products/${product.id}/edit`}
                className="text-[12.5px] font-semibold text-brand hover:underline"
              >
                Manage
              </Link>
            )}
          </div>
          {approvedClaims.length === 0 ? (
            <p className="text-[13px] text-ink-faint">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {approvedClaims.map((claim) => (
                <li
                  key={claim.id}
                  className="flex gap-2 text-[13px] leading-snug text-ink-muted"
                >
                  <span className="mt-0.5 flex-shrink-0 text-approve">✓</span>
                  <span>{claim.claimText}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {product.disclaimerText && (
        <div className="flex flex-col gap-1.5 rounded-card border border-edge bg-surface p-[22px]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
            Mandatory disclaimer
          </span>
          <p className="text-[13px] italic leading-snug text-ink-muted">
            {product.disclaimerText}
          </p>
        </div>
      )}
    </div>
  );
}
