"use client";

import { useState } from "react";
import { Check, Download, FileArchive, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildWorkspacePackageAsync,
  workspaceKeyFromName,
  type PackageBuilderDraft,
  type PackageBuilderFile,
} from "@/lib/onboarding/package-builder";
import type { WorkspaceBlueprintRole } from "@/lib/onboarding/blueprint";

export type GeneratedOnboardingPackage = {
  file: File;
  workspaceName: string;
  workspaceKey: string;
  counts: Record<string, number>;
};

type Identified = { id: string };
type UserRow = Identified & PackageBuilderDraft["users"][number];
type ProductRow = Identified & PackageBuilderDraft["products"][number];
type CampaignRow = Identified & PackageBuilderDraft["campaigns"][number];
type DocumentRow = Identified & Omit<PackageBuilderDraft["documents"][number], "file"> & { file: File | null };
type ClaimRow = Identified & PackageBuilderDraft["claims"][number];
type AssetRow = Identified & Omit<PackageBuilderDraft["assets"][number], "file"> & { file: File | null };
type TemplateRow = Identified & Omit<PackageBuilderDraft["templateBundles"][number], "archive"> & { archive: File | null };

function rowId() {
  return crypto.randomUUID();
}

function keyFromName(value: string, fallback: string) {
  const result = workspaceKeyFromName(value);
  return result === "client-workspace" ? fallback : result;
}

function replaceRow<T extends Identified>(rows: T[], id: string, patch: Partial<T>) {
  return rows.map((row) => row.id === id ? { ...row, ...patch } : row);
}

function withoutId<T extends Identified>(row: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...row };
  delete copy.id;
  return copy as Omit<T, "id">;
}

async function browserFile(file: File): Promise<PackageBuilderFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-caption leading-relaxed text-ink-muted">{children}</p>;
}

function SectionHeading({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-caption font-bold text-white">
        {number}
      </span>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-small text-ink-muted">{description}</p>
      </div>
    </div>
  );
}

const selectClassName = "h-10 w-full rounded-control border border-edge-strong bg-surface px-3 text-small text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function PackageBuilder({
  built,
  onPackageBuilt,
}: {
  built: GeneratedOnboardingPackage | null;
  onPackageBuilt: (value: GeneratedOnboardingPackage) => void;
}) {
  const [workspace, setWorkspace] = useState({ key: "", name: "", industry: "" });
  // These three seed rows are rendered during SSR, so their ids must be stable
  // across server and client. crypto.randomUUID() produced a different id on
  // each side, and because the ids drive input id/htmlFor pairs that surfaced
  // as a React hydration attribute mismatch on every load of this page. Rows
  // added later are created in event handlers, client-side only, where a random
  // id is fine.
  const [users, setUsers] = useState<UserRow[]>(() => [
    { id: "client-admin", key: "client-admin", email: "", fullName: "", role: "admin" },
  ]);
  const [products, setProducts] = useState<ProductRow[]>(() => [
    { id: "primary-product", key: "primary-product", name: "", description: "", disclaimer: "" },
  ]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(() => [
    { id: "launch-campaign", key: "launch-campaign", productKey: "primary-product", name: "", status: "active", brief: "" },
  ]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [qaQuestion, setQaQuestion] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvalReference, setApprovalReference] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [templateSignoffConfirmed, setTemplateSignoffConfirmed] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateWorkspaceName(name: string) {
    setWorkspace((current) => ({
      ...current,
      name,
      key: current.key && current.key !== workspaceKeyFromName(current.name)
        ? current.key
        : workspaceKeyFromName(name),
    }));
  }

  function updateProduct(id: string, patch: Partial<ProductRow>) {
    const previous = products.find((product) => product.id === id);
    setProducts((current) => replaceRow(current, id, patch));
    if (!patch.key || previous?.key === patch.key) return;
    setCampaigns((rows) => rows.map((row) => row.productKey === previous?.key ? { ...row, productKey: patch.key! } : row));
    setDocuments((rows) => rows.map((row) => row.productKey === previous?.key ? { ...row, productKey: patch.key } : row));
    setClaims((rows) => rows.map((row) => row.productKey === previous?.key ? { ...row, productKey: patch.key! } : row));
    setAssets((rows) => rows.map((row) => row.productKey === previous?.key ? { ...row, productKey: patch.key } : row));
    setTemplates((rows) => rows.map((row) => ({
      ...row,
      assignToProducts: row.assignToProducts.map((key) => key === previous?.key ? patch.key! : key),
    })));
  }

  async function buildPackage() {
    setError(null);
    setBuilding(true);
    try {
      for (const claim of claims) {
        if (claim.status === "approved" && (!claim.sourceDocumentKey || !claim.sourceParagraph)) {
          throw new Error(`Approved claim "${claim.key}" needs a source document and paragraph.`);
        }
      }
      const documentInputs = await Promise.all(documents.map(async (row) => {
        const { file, ...document } = withoutId(row);
        return { ...document, file: file ? await browserFile(file) : undefined };
      }));
      const assetInputs = await Promise.all(assets.map(async (row) => {
        const { file, ...asset } = withoutId(row);
        if (!file) throw new Error(`Choose a file for asset "${asset.key}".`);
        return { ...asset, file: await browserFile(file) };
      }));
      const templateInputs = await Promise.all(templates.map(async (row) => {
        const { archive, ...template } = withoutId(row);
        if (!archive) throw new Error(`Choose a ZIP for template bundle "${template.key}".`);
        return { ...template, archive: await browserFile(archive) };
      }));
      const firstProduct = products[0]?.key;
      const firstTemplate = templates.find((template) => template.assignToProducts.includes(firstProduct))?.key;
      const result = await buildWorkspacePackageAsync({
        workspace,
        users: users.map(withoutId),
        products: products.map(withoutId),
        campaigns: campaigns.map(withoutId),
        documents: documentInputs,
        claims: claims.map(withoutId),
        assets: assetInputs,
        templateBundles: templateInputs,
        qa: firstProduct && qaQuestion.trim()
          ? { productKey: firstProduct, templateBundleKey: firstTemplate, knowledgeQuestion: qaQuestion.trim() }
          : undefined,
        review: {
          preparedBy,
          clientApprovalReference: approvalReference,
          rightsConfirmed,
          templateSignoffConfirmed,
        },
      });
      const generated: GeneratedOnboardingPackage = {
        file: new File([result.bytes as Uint8Array<ArrayBuffer>], result.fileName, { type: "application/zip" }),
        workspaceName: result.blueprint.workspace.name,
        workspaceKey: result.blueprint.workspace.key,
        counts: {
          users: result.blueprint.users.length,
          products: result.blueprint.products.length,
          campaigns: result.blueprint.campaigns?.length ?? 0,
          documents: result.blueprint.documents?.length ?? 0,
          claims: result.blueprint.claims?.length ?? 0,
          assets: result.blueprint.assets?.length ?? 0,
          templates: result.blueprint.templateBundles?.length ?? 0,
        },
      };
      onPackageBuilt(generated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build the package.");
    } finally {
      setBuilding(false);
    }
  }

  function downloadPackage() {
    if (!built) return;
    const href = URL.createObjectURL(built.file);
    const link = document.createElement("a");
    link.href = href;
    link.download = built.file.name;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="rounded-card border border-edge bg-surface p-5 shadow-card" aria-labelledby="package-builder-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
          <FileArchive aria-hidden />
        </span>
        <div>
          <p className="text-overline uppercase tracking-[0.16em] text-brand">Prepare</p>
          <h2 id="package-builder-heading" className="text-h3 font-semibold text-ink">Build the reviewed client package</h2>
          <p className="mt-1 max-w-3xl text-small text-ink-muted">
            Enter the approved handoff once. The builder creates the portable blueprint, places files in safe folders, and produces the ZIP used by preflight.
          </p>
        </div>
      </div>

      <fieldset disabled={Boolean(built)} className="mt-6 flex flex-col gap-6 disabled:opacity-75">
        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={1} title="Client workspace" description="The permanent client identity. Keys become stable references, not database IDs." />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="builder-workspace-name">Client or workspace name</Label>
              <Input id="builder-workspace-name" value={workspace.name} onChange={(event) => updateWorkspaceName(event.target.value)} placeholder="Northstar Roasters" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="builder-workspace-key">Workspace key</Label>
              <Input id="builder-workspace-key" value={workspace.key} onChange={(event) => setWorkspace((current) => ({ ...current, key: event.target.value.toLowerCase() }))} placeholder="northstar-roasters" required />
              <FieldHint>2–63 lowercase letters, numbers, hyphens, or underscores.</FieldHint>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="builder-industry">Industry</Label>
              <Input id="builder-industry" value={workspace.industry} onChange={(event) => setWorkspace((current) => ({ ...current, industry: event.target.value }))} placeholder="Specialty coffee" />
            </div>
          </div>
        </div>

        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={2} title="Initial people and permissions" description="Every workspace needs at least one client admin. Add approvers and members only when their access is confirmed." />
          <div className="mt-4 flex flex-col gap-3">
            {users.map((user, index) => (
              <div key={user.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-[1fr_1.35fr_1fr_0.8fr_auto] md:items-end">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`user-name-${user.id}`}>Full name</Label>
                  <Input id={`user-name-${user.id}`} value={user.fullName} onChange={(event) => setUsers((rows) => replaceRow(rows, user.id, { fullName: event.target.value }))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`user-email-${user.id}`}>Work email</Label>
                  <Input id={`user-email-${user.id}`} type="email" value={user.email} onChange={(event) => setUsers((rows) => replaceRow(rows, user.id, { email: event.target.value }))} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`user-key-${user.id}`}>User key</Label>
                  <Input id={`user-key-${user.id}`} value={user.key} onChange={(event) => setUsers((rows) => replaceRow(rows, user.id, { key: event.target.value.toLowerCase() }))} required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`user-role-${user.id}`}>Role</Label>
                  <select id={`user-role-${user.id}`} className={selectClassName} value={user.role} onChange={(event) => setUsers((rows) => replaceRow(rows, user.id, { role: event.target.value as WorkspaceBlueprintRole }))}>
                    <option value="admin">Admin</option>
                    <option value="approver">Approver</option>
                    <option value="member">Member</option>
                  </select>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove user ${index + 1}`} onClick={() => setUsers((rows) => rows.filter((row) => row.id !== user.id))} disabled={users.length === 1}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setUsers((rows) => [...rows, { id: rowId(), key: `user-${rows.length + 1}`, email: "", fullName: "", role: "member" }])}>
              <Plus aria-hidden /> Add person
            </Button>
          </div>
        </div>

        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={3} title="Products and campaigns" description="Products own claims, assets, sources, and templates. Campaigns group the launch work for a product." />
          <div className="mt-4 flex flex-col gap-4">
            {products.map((product, index) => (
              <div key={product.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`product-name-${product.id}`}>Product name</Label>
                  <Input id={`product-name-${product.id}`} value={product.name} onChange={(event) => updateProduct(product.id, { name: event.target.value, key: product.key === keyFromName(product.name, `product-${index + 1}`) ? keyFromName(event.target.value, `product-${index + 1}`) : product.key })} required />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor={`product-key-${product.id}`}>Product key</Label>
                    <Input id={`product-key-${product.id}`} value={product.key} onChange={(event) => updateProduct(product.id, { key: event.target.value.toLowerCase() })} required />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove product ${index + 1}`} onClick={() => setProducts((rows) => rows.filter((row) => row.id !== product.id))} disabled={products.length === 1}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor={`product-description-${product.id}`}>Approved product description</Label>
                  <Textarea id={`product-description-${product.id}`} value={product.description} onChange={(event) => updateProduct(product.id, { description: event.target.value })} rows={2} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor={`product-disclaimer-${product.id}`}>Required disclaimer</Label>
                  <Textarea id={`product-disclaimer-${product.id}`} value={product.disclaimer} onChange={(event) => updateProduct(product.id, { disclaimer: event.target.value })} rows={2} />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setProducts((rows) => [...rows, { id: rowId(), key: `product-${rows.length + 1}`, name: "", description: "", disclaimer: "" }])}>
              <Plus aria-hidden /> Add product
            </Button>

            <div className="border-t border-edge pt-4">
              <p className="mb-3 text-small font-semibold text-ink">Campaigns</p>
              <div className="flex flex-col gap-3">
                {campaigns.map((campaign, index) => (
                  <div key={campaign.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-[1fr_1fr_1fr_0.8fr_auto] md:items-end">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`campaign-name-${campaign.id}`}>Campaign name</Label>
                      <Input id={`campaign-name-${campaign.id}`} value={campaign.name} onChange={(event) => setCampaigns((rows) => replaceRow(rows, campaign.id, { name: event.target.value }))} required />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`campaign-key-${campaign.id}`}>Campaign key</Label>
                      <Input id={`campaign-key-${campaign.id}`} value={campaign.key} onChange={(event) => setCampaigns((rows) => replaceRow(rows, campaign.id, { key: event.target.value.toLowerCase() }))} required />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`campaign-product-${campaign.id}`}>Product</Label>
                      <select id={`campaign-product-${campaign.id}`} className={selectClassName} value={campaign.productKey} onChange={(event) => setCampaigns((rows) => replaceRow(rows, campaign.id, { productKey: event.target.value }))}>
                        {products.map((product) => <option key={product.id} value={product.key}>{product.name || product.key}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`campaign-status-${campaign.id}`}>Status</Label>
                      <select id={`campaign-status-${campaign.id}`} className={selectClassName} value={campaign.status} onChange={(event) => setCampaigns((rows) => replaceRow(rows, campaign.id, { status: event.target.value as CampaignRow["status"] }))}>
                        <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
                      </select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove campaign ${index + 1}`} onClick={() => setCampaigns((rows) => rows.filter((row) => row.id !== campaign.id))}>
                      <Trash2 aria-hidden />
                    </Button>
                    <div className="flex flex-col gap-2 md:col-span-5">
                      <Label htmlFor={`campaign-brief-${campaign.id}`}>Approved campaign brief</Label>
                      <Textarea id={`campaign-brief-${campaign.id}`} value={campaign.brief} onChange={(event) => setCampaigns((rows) => replaceRow(rows, campaign.id, { brief: event.target.value }))} rows={2} />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-fit" onClick={() => setCampaigns((rows) => [...rows, { id: rowId(), key: `campaign-${rows.length + 1}`, productKey: products[0]?.key ?? "", name: "", status: "draft", brief: "" }])}>
                  <Plus aria-hidden /> Add campaign
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={4} title="Approved knowledge and claims" description="Attach final source files or paste approved text. Every approved claim should cite the exact source and paragraph." />
          <div className="mt-4 flex flex-col gap-4">
            {documents.map((document, index) => (
              <div key={document.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor={`document-title-${document.id}`}>Source title</Label><Input id={`document-title-${document.id}`} value={document.title} onChange={(event) => setDocuments((rows) => replaceRow(rows, document.id, { title: event.target.value }))} required /></div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2"><Label htmlFor={`document-key-${document.id}`}>Source key</Label><Input id={`document-key-${document.id}`} value={document.key} onChange={(event) => setDocuments((rows) => replaceRow(rows, document.id, { key: event.target.value.toLowerCase() }))} required /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove source ${index + 1}`} onClick={() => setDocuments((rows) => rows.filter((row) => row.id !== document.id))}><Trash2 aria-hidden /></Button>
                </div>
                <div className="flex flex-col gap-2"><Label htmlFor={`document-product-${document.id}`}>Product</Label><select id={`document-product-${document.id}`} className={selectClassName} value={document.productKey} onChange={(event) => setDocuments((rows) => replaceRow(rows, document.id, { productKey: event.target.value }))}><option value="">Workspace-wide</option>{products.map((product) => <option key={product.id} value={product.key}>{product.name || product.key}</option>)}</select></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`document-file-${document.id}`}>Approved source file</Label><Input id={`document-file-${document.id}`} type="file" accept=".pdf,.docx,.txt,.md" onChange={(event) => setDocuments((rows) => replaceRow(rows, document.id, { file: event.target.files?.[0] ?? null }))} /><FieldHint>PDF, DOCX, TXT, or Markdown. Inline text below may be used instead.</FieldHint></div>
                <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor={`document-content-${document.id}`}>Approved inline text</Label><Textarea id={`document-content-${document.id}`} value={document.content} onChange={(event) => setDocuments((rows) => replaceRow(rows, document.id, { content: event.target.value }))} rows={4} placeholder="Paragraph 1…" /></div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setDocuments((rows) => [...rows, { id: rowId(), key: `approved-source-${rows.length + 1}`, productKey: products[0]?.key, title: "", approvalStatus: "approved", content: "", file: null }])}><Plus aria-hidden /> Add approved source</Button>

            {claims.length > 0 && <div className="border-t border-edge pt-4"><p className="mb-3 text-small font-semibold text-ink">Approved claims</p></div>}
            {claims.map((claim, index) => (
              <div key={claim.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-2">
                <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor={`claim-text-${claim.id}`}>Exact approved claim</Label><Textarea id={`claim-text-${claim.id}`} value={claim.text} onChange={(event) => setClaims((rows) => replaceRow(rows, claim.id, { text: event.target.value }))} rows={2} required /></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`claim-key-${claim.id}`}>Claim key</Label><Input id={`claim-key-${claim.id}`} value={claim.key} onChange={(event) => setClaims((rows) => replaceRow(rows, claim.id, { key: event.target.value.toLowerCase() }))} required /></div>
                <div className="flex items-end gap-2"><div className="flex flex-1 flex-col gap-2"><Label htmlFor={`claim-product-${claim.id}`}>Product</Label><select id={`claim-product-${claim.id}`} className={selectClassName} value={claim.productKey} onChange={(event) => setClaims((rows) => replaceRow(rows, claim.id, { productKey: event.target.value }))}>{products.map((product) => <option key={product.id} value={product.key}>{product.name || product.key}</option>)}</select></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove claim ${index + 1}`} onClick={() => setClaims((rows) => rows.filter((row) => row.id !== claim.id))}><Trash2 aria-hidden /></Button></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`claim-source-${claim.id}`}>Source document</Label><select id={`claim-source-${claim.id}`} className={selectClassName} value={claim.sourceDocumentKey} onChange={(event) => setClaims((rows) => replaceRow(rows, claim.id, { sourceDocumentKey: event.target.value }))}><option value="">Choose source</option>{documents.filter((document) => document.productKey === claim.productKey).map((document) => <option key={document.id} value={document.key}>{document.title || document.key}</option>)}</select></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`claim-paragraph-${claim.id}`}>Source paragraph</Label><Input id={`claim-paragraph-${claim.id}`} type="number" min={1} value={claim.sourceParagraph ?? ""} onChange={(event) => setClaims((rows) => replaceRow(rows, claim.id, { sourceParagraph: event.target.value ? Number(event.target.value) : undefined }))} required /></div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setClaims((rows) => [...rows, { id: rowId(), key: `approved-claim-${rows.length + 1}`, productKey: products[0]?.key ?? "", text: "", sourceDocumentKey: documents.find((document) => document.productKey === products[0]?.key)?.key, sourceParagraph: 1, status: "approved" }])} disabled={documents.length === 0}><Plus aria-hidden /> Add approved claim</Button>
            {documents.length === 0 && <FieldHint>Add an approved source before adding claims.</FieldHint>}
          </div>
        </div>

        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={5} title="Approved assets and templates" description="Assets are the final licensed files. Template bundles are the signed-off portable ZIPs produced by the template workflow." />
          <div className="mt-4 flex flex-col gap-4">
            {assets.map((asset, index) => (
              <div key={asset.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor={`asset-file-${asset.id}`}>Asset file</Label><Input id={`asset-file-${asset.id}`} type="file" accept="image/*,.svg" onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { file: event.target.files?.[0] ?? null }))} required /></div>
                <div className="flex items-end gap-2"><div className="flex flex-1 flex-col gap-2"><Label htmlFor={`asset-key-${asset.id}`}>Asset key</Label><Input id={`asset-key-${asset.id}`} value={asset.key} onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { key: event.target.value.toLowerCase() }))} required /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove asset ${index + 1}`} onClick={() => setAssets((rows) => rows.filter((row) => row.id !== asset.id))}><Trash2 aria-hidden /></Button></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`asset-title-${asset.id}`}>Title</Label><Input id={`asset-title-${asset.id}`} value={asset.title} onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { title: event.target.value }))} /></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`asset-product-${asset.id}`}>Product</Label><select id={`asset-product-${asset.id}`} className={selectClassName} value={asset.productKey} onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { productKey: event.target.value }))}><option value="">Workspace-wide</option>{products.map((product) => <option key={product.id} value={product.key}>{product.name || product.key}</option>)}</select></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`asset-type-${asset.id}`}>Asset type</Label><select id={`asset-type-${asset.id}`} className={selectClassName} value={asset.type} onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { type: event.target.value as AssetRow["type"] }))}><option value="logo">Logo</option><option value="packshot">Packshot</option><option value="background">Background</option><option value="image">Image</option></select></div>
                <div className="flex flex-col gap-2"><Label htmlFor={`asset-alt-${asset.id}`}>Alt text</Label><Input id={`asset-alt-${asset.id}`} value={asset.altText} onChange={(event) => setAssets((rows) => replaceRow(rows, asset.id, { altText: event.target.value }))} /></div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setAssets((rows) => [...rows, { id: rowId(), key: `asset-${rows.length + 1}`, productKey: products[0]?.key, type: "image", title: "", altText: "", tags: [], approvalStatus: "approved", file: null }])}><Plus aria-hidden /> Add asset</Button>

            {templates.map((template, index) => (
              <div key={template.id} className="grid gap-3 rounded-control bg-page p-3 md:grid-cols-2">
                <div className="flex flex-col gap-2"><Label htmlFor={`template-file-${template.id}`}>Portable template bundle ZIP</Label><Input id={`template-file-${template.id}`} type="file" accept=".zip,application/zip" onChange={(event) => setTemplates((rows) => replaceRow(rows, template.id, { archive: event.target.files?.[0] ?? null }))} required /></div>
                <div className="flex items-end gap-2"><div className="flex flex-1 flex-col gap-2"><Label htmlFor={`template-key-${template.id}`}>Bundle key</Label><Input id={`template-key-${template.id}`} value={template.key} onChange={(event) => setTemplates((rows) => replaceRow(rows, template.id, { key: event.target.value.toLowerCase() }))} required /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove template bundle ${index + 1}`} onClick={() => setTemplates((rows) => rows.filter((row) => row.id !== template.id))}><Trash2 aria-hidden /></Button></div>
                <fieldset className="md:col-span-2"><legend className="text-small font-medium text-ink">Assign to products</legend><div className="mt-2 flex flex-wrap gap-4">{products.map((product) => <label key={product.id} className="flex items-center gap-2 text-small text-ink"><input type="checkbox" checked={template.assignToProducts.includes(product.key)} onChange={(event) => setTemplates((rows) => replaceRow(rows, template.id, { assignToProducts: event.target.checked ? [...template.assignToProducts, product.key] : template.assignToProducts.filter((key) => key !== product.key) }))} />{product.name || product.key}</label>)}</div></fieldset>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={() => setTemplates((rows) => [...rows, { id: rowId(), key: `template-${rows.length + 1}`, assignToProducts: products[0] ? [products[0].key] : [], archive: null }])}><Plus aria-hidden /> Add template bundle</Button>
          </div>
        </div>

        <div className="rounded-card border border-edge p-4">
          <SectionHeading number={6} title="Launch evidence and handoff" description="Record who prepared the package and where client approval is documented. These confirmations do not replace server preflight." />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="builder-prepared-by">Prepared by</Label><Input id="builder-prepared-by" value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)} placeholder="Name or delivery team" required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="builder-approval-reference">Client approval reference</Label><Input id="builder-approval-reference" value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} placeholder="Signed brief CG-2026-014 or approval email date" required /></div>
            <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor="builder-qa-question">Representative QA question</Label><Input id="builder-qa-question" value={qaQuestion} onChange={(event) => setQaQuestion(event.target.value)} placeholder="What is the approved product benefit?" /><FieldHint>Used after provisioning to confirm the workspace has usable knowledge.</FieldHint></div>
            <div className="flex items-start gap-3 rounded-control border border-edge p-3 text-small text-ink"><input id="builder-rights-confirmed" aria-describedby="builder-rights-description" className="mt-0.5" type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /><div><Label htmlFor="builder-rights-confirmed">Usage rights confirmed.</Label><p id="builder-rights-description" className="mt-1 text-ink-muted">Logos, images, fonts, and other assets are approved and licensed for this campaign.</p></div></div>
            <div className="flex items-start gap-3 rounded-control border border-edge p-3 text-small text-ink"><input id="builder-template-signoff" aria-describedby="builder-template-description" className="mt-0.5" type="checkbox" checked={templateSignoffConfirmed} onChange={(event) => setTemplateSignoffConfirmed(event.target.checked)} /><div><Label htmlFor="builder-template-signoff">Template contract signed off.</Label><p id="builder-template-description" className="mt-1 text-ink-muted">Sizes, locked elements, editable fields, copy limits, and references are final.</p></div></div>
          </div>
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-edge pt-5">
        {!built ? <Button type="button" onClick={buildPackage} disabled={building}>
          <FileArchive aria-hidden /> {building ? "Building package…" : "Build reviewed ZIP"}
        </Button> : null}
        {built && <Button type="button" variant="outline" onClick={downloadPackage}><Download aria-hidden /> Download copy</Button>}
        {built && <span className="inline-flex items-center gap-1.5 text-small font-medium text-approve"><Check className="size-4" aria-hidden /> Ready for preflight: {built.file.name}</span>}
      </div>
      <p className="mt-3 whitespace-pre-line text-small text-reject" role="status" aria-live="polite">{error}</p>
    </section>
  );
}
