"use client";

import { useMemo, useState } from "react";

type ImportIssue = {
  path?: string;
  message?: string;
  severity?: string;
  code?: string;
};

type ProductOption = {
  id: string;
  name: string;
};

type VersionOption = {
  id: string;
  familyName: string;
  versionLabel: string;
  status: string;
  variants: { key: string; label: string; width: number; height: number }[];
};

function filePath(file: File) {
  const withDirectory = file as File & { webkitRelativePath?: string };
  return withDirectory.webkitRelativePath || file.name;
}

function stripBase64Prefix(value: string) {
  return value.split(",", 2)[1] ?? "";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: File) {
  return file.text();
}

function issueText(issue: ImportIssue) {
  return [
    issue.severity ? issue.severity.toUpperCase() : null,
    issue.path,
    issue.message ?? issue.code,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ImportBundlePanel() {
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [manifestText, setManifestText] = useState("");
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [storagePrefix, setStoragePrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onImport() {
    setBusy(true);
    setResult(null);
    setIssues([]);
    setError(null);
    try {
      const manifest = JSON.parse(
        manifestFile ? await readFileAsText(manifestFile) : manifestText
      ) as {
        assets?: { path: string; mimeType?: string }[];
      };
      if (!Array.isArray(manifest.assets)) {
        throw new Error("Manifest must include an assets array.");
      }

      const selectedFiles = new Map(
        assetFiles.map((file) => [filePath(file), file])
      );
      const assets = await Promise.all(
        manifest.assets.map(async (asset) => {
          const file =
            selectedFiles.get(asset.path) ??
            [...selectedFiles.entries()].find(([path]) =>
              path.endsWith(`/${asset.path}`)
            )?.[1];
          if (!file) throw new Error(`Missing asset file: ${asset.path}`);
          return {
            path: asset.path,
            contentType: file.type || asset.mimeType,
            dataBase64: stripBase64Prefix(await readFileAsDataUrl(file)),
          };
        })
      );

      const response = await fetch("/api/template-bundles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifest,
          assets,
          storagePrefix: storagePrefix.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setIssues(Array.isArray(payload.issues) ? payload.issues : []);
        throw new Error(payload.error ?? "Template bundle import failed.");
      }
      setResult(
        `Imported ${payload.variants?.length ?? 0} variants. Version: ${payload.templateVersionId}`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-bold">Import bundle</h2>
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Upload a template bundle manifest plus every asset referenced by the
          manifest. Directory uploads are supported when your browser provides
          relative paths.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
            Manifest JSON
          </span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => setManifestFile(event.target.files?.[0] ?? null)}
            className="rounded-control border border-edge bg-page px-3 py-2 text-[12px]"
          />
        </label>
        <textarea
          value={manifestText}
          onChange={(event) => setManifestText(event.target.value)}
          placeholder="Or paste manifest JSON here"
          rows={4}
          className="resize-y rounded-control border border-edge bg-page px-3 py-2 text-[12px] outline-none focus:border-brand"
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
            Asset files
          </span>
          <input
            type="file"
            multiple
            onChange={(event) => setAssetFiles(Array.from(event.target.files ?? []))}
            className="rounded-control border border-edge bg-page px-3 py-2 text-[12px]"
          />
          <span className="text-[11px] text-ink-faint">
            Selected {assetFiles.length} files.
          </span>
        </label>
        <input
          value={storagePrefix}
          onChange={(event) => setStoragePrefix(event.target.value)}
          placeholder="Optional storage prefix"
          className="rounded-control border border-edge bg-page px-3 py-2 text-[12px] outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={onImport}
          disabled={busy || (!manifestFile && !manifestText.trim())}
          className="rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import and preflight"}
        </button>
        {result && <p className="text-[12px] font-semibold text-approve">{result}</p>}
        {error && <p className="text-[12px] font-semibold text-reject">{error}</p>}
        {issues.length > 0 && (
          <ul className="grid gap-1 rounded-control border border-reject-border bg-reject-tint p-3 text-[11px] text-reject">
            {issues.slice(0, 6).map((issue, index) => (
              <li key={`${issue.path ?? issue.code ?? "issue"}-${index}`}>
                {issueText(issue)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PublishVersionButton({
  versionId,
  status,
}: {
  versionId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const published = status === "published";

  async function publish() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/template-bundles/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateVersionId: versionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Publish failed.");
      setMessage(payload.alreadyPublished ? "Already published." : "Published.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={publish}
        disabled={busy || published}
        className="rounded-control border border-brand px-3 py-1.5 text-[11.5px] font-semibold text-brand disabled:border-edge disabled:text-ink-faint"
      >
        {published ? "Published" : busy ? "Publishing…" : "Publish"}
      </button>
      {(message || error) && (
        <span className={`text-[10.5px] ${error ? "text-reject" : "text-approve"}`}>
          {error ?? message}
        </span>
      )}
    </div>
  );
}

export function AssignTemplatePanel({
  products,
  versions,
}: {
  products: ProductOption[];
  versions: VersionOption[];
}) {
  const publishedVersions = useMemo(
    () => versions.filter((version) => version.status === "published"),
    [versions]
  );
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [versionId, setVersionId] = useState(publishedVersions[0]?.id ?? "");
  const selectedVersion = publishedVersions.find((version) => version.id === versionId);
  const [defaultVariantKey, setDefaultVariantKey] = useState(
    selectedVersion?.variants[0]?.key ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectVersion(nextId: string) {
    setVersionId(nextId);
    const nextVersion = publishedVersions.find((version) => version.id === nextId);
    setDefaultVariantKey(nextVersion?.variants[0]?.key ?? "");
  }

  async function assign() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/product-template-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          templateVersionId: versionId,
          defaultVariantKey: defaultVariantKey || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Assignment failed.");
      setMessage("Template assigned to product.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-bold">Assign to product</h2>
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Publish a version first, then assign it to a product workspace.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="rounded-control border border-edge bg-page px-3 py-2 text-[12px] outline-none focus:border-brand"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select
          value={versionId}
          onChange={(event) => selectVersion(event.target.value)}
          className="rounded-control border border-edge bg-page px-3 py-2 text-[12px] outline-none focus:border-brand"
        >
          {publishedVersions.length ? (
            publishedVersions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.familyName} · {version.versionLabel}
              </option>
            ))
          ) : (
            <option value="">No published versions</option>
          )}
        </select>
        <select
          value={defaultVariantKey}
          onChange={(event) => setDefaultVariantKey(event.target.value)}
          className="rounded-control border border-edge bg-page px-3 py-2 text-[12px] outline-none focus:border-brand"
        >
          {(selectedVersion?.variants ?? []).map((variant) => (
            <option key={variant.key} value={variant.key}>
              {variant.label} · {variant.width}×{variant.height}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={busy || !productId || !versionId}
          className="rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Assigning…" : "Assign template"}
        </button>
        {message && <p className="text-[12px] font-semibold text-approve">{message}</p>}
        {error && <p className="text-[12px] font-semibold text-reject">{error}</p>}
      </div>
    </div>
  );
}
