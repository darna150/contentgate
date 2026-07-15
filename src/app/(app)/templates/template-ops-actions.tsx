"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function issueDetail(issue: ImportIssue) {
  return [issue.path, issue.message ?? issue.code].filter(Boolean).join(" · ");
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
    <Card>
      <CardHeader>
        <CardTitle>Import bundle</CardTitle>
        <CardDescription>
          Upload a template bundle manifest plus every asset referenced by the
          manifest. Directory uploads are supported when your browser provides
          relative paths.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-manifest-file">Manifest JSON</Label>
          <input
            id="import-manifest-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => setManifestFile(event.target.files?.[0] ?? null)}
            className="rounded-control border border-edge bg-page px-3 py-2 text-[12px]"
          />
        </div>
        <Textarea
          value={manifestText}
          onChange={(event) => setManifestText(event.target.value)}
          placeholder="Or paste manifest JSON here"
          rows={4}
          className="resize-y"
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-asset-files">Asset files</Label>
          <input
            id="import-asset-files"
            type="file"
            multiple
            onChange={(event) => setAssetFiles(Array.from(event.target.files ?? []))}
            className="rounded-control border border-edge bg-page px-3 py-2 text-[12px]"
          />
          <span className="text-[11px] text-ink-faint">
            Selected {assetFiles.length} files.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-storage-prefix">Storage prefix</Label>
          <Input
            id="import-storage-prefix"
            value={storagePrefix}
            onChange={(event) => setStoragePrefix(event.target.value)}
            placeholder="Optional storage prefix"
          />
        </div>
        <Button
          onClick={onImport}
          disabled={busy || (!manifestFile && !manifestText.trim())}
        >
          {busy ? "Importing…" : "Import and preflight"}
        </Button>
        {result && <p className="text-[12px] font-semibold text-approve">{result}</p>}
        {error && <p className="text-[12px] font-semibold text-reject">{error}</p>}
        {issues.length > 0 && (
          <Card className="gap-2 bg-page p-4">
            <p className="text-label text-ink-faint">Import issues</p>
            <ul className="grid gap-2">
              {issues.slice(0, 6).map((issue, index) => (
                <li
                  key={`${issue.path ?? issue.code ?? "issue"}-${index}`}
                  className="flex items-start gap-2 text-[12px] text-ink"
                >
                  <Badge
                    variant={issue.severity === "warning" ? "warn" : "reject"}
                    className="mt-0.5 shrink-0"
                  >
                    {issue.severity === "warning" ? "Warning" : "Error"}
                  </Badge>
                  <span className="min-w-0 flex-1">{issueDetail(issue)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </CardContent>
    </Card>
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
      <Button
        variant="outline"
        size="sm"
        onClick={publish}
        disabled={busy || published}
      >
        {published ? "Published" : busy ? "Publishing…" : "Publish"}
      </Button>
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

  const variantOptions = selectedVersion?.variants ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign to product</CardTitle>
        <CardDescription>
          Publish a version first, then assign it to a product workspace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-product">Product</Label>
          <Select value={productId} onValueChange={setProductId} disabled={!products.length}>
            <SelectTrigger id="assign-product" className="w-full">
              <SelectValue placeholder="No active products" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-version">Template version</Label>
          <Select
            value={versionId}
            onValueChange={selectVersion}
            disabled={!publishedVersions.length}
          >
            <SelectTrigger id="assign-version" className="w-full">
              <SelectValue placeholder="No published versions" />
            </SelectTrigger>
            <SelectContent>
              {publishedVersions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.familyName} · {version.versionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-variant">Default variant</Label>
          <Select
            value={defaultVariantKey}
            onValueChange={setDefaultVariantKey}
            disabled={!variantOptions.length}
          >
            <SelectTrigger id="assign-variant" className="w-full">
              <SelectValue placeholder="No variants" />
            </SelectTrigger>
            <SelectContent>
              {variantOptions.map((variant) => (
                <SelectItem key={variant.key} value={variant.key}>
                  {variant.label} · {variant.width}×{variant.height}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={assign} disabled={busy || !productId || !versionId}>
          {busy ? "Assigning…" : "Assign template"}
        </Button>
        {message && <p className="text-[12px] font-semibold text-approve">{message}</p>}
        {error && <p className="text-[12px] font-semibold text-reject">{error}</p>}
      </CardContent>
    </Card>
  );
}
