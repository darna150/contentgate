import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

import sharp from "sharp";

import { documentFileType, validateDocumentFile } from "../document-files.ts";
import { extractDocumentTextCore } from "../document-extraction-core.ts";
import { segmentParagraphs } from "../paragraphs.ts";
import { loadTemplateBundleDirectory } from "../template-platform/bundle-directory.ts";
import { preflightTemplateBundle } from "../template-platform/preflight.ts";
import type { TemplateBundleDirectory } from "../template-platform/bundle-directory.ts";
import { blueprintSha256, bytesSha256, workspacePackageSha256 } from "./canonical.ts";
import {
  preflightWorkspaceBlueprint,
  type BlueprintIssue,
  type BlueprintPreflightReport,
  type WorkspaceBlueprint,
} from "./blueprint.ts";

const ASSET_MIME_BY_SHARP_FORMAT: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;

export type PreparedDocument = {
  key: string;
  content: string;
  paragraphs: Array<{ n: number; text: string }>;
  fileType: string;
  upload?: {
    data: Uint8Array;
    contentType: string;
    fileName: string;
  };
};

export type PreparedAsset = {
  key: string;
  data: Uint8Array;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  widthPixels: number | null;
  heightPixels: number | null;
};

export type PreparedTemplateBundle = {
  key: string;
  assignToProducts: string[];
  bundle: TemplateBundleDirectory;
};

export type PreparedWorkspacePackage = {
  root: string;
  blueprint: WorkspaceBlueprint;
  blueprintSha256: string;
  documents: PreparedDocument[];
  assets: PreparedAsset[];
  templateBundles: PreparedTemplateBundle[];
};

export type WorkspacePackagePreflight = {
  ok: boolean;
  blueprint: BlueprintPreflightReport;
  issues: BlueprintIssue[];
  prepared: PreparedWorkspacePackage | null;
};

function isInside(parent: string, child: string) {
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(prefix);
}

async function safePackagePath(root: string, relativePath: string) {
  const candidate = resolve(root, relativePath);
  if (!isInside(root, candidate)) throw new Error("Path escapes the workspace package.");
  const resolved = await realpath(candidate);
  if (!isInside(root, resolved)) throw new Error("Symlink escapes the workspace package.");
  return resolved;
}

function packageIssue(path: string, message: string): BlueprintIssue {
  return { code: "package_path", path, message };
}

function contentTypeForDocument(name: string) {
  const extension = extname(name).slice(1).toLowerCase();
  const byExtension: Record<string, string> = {
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    htm: "text/html",
    html: "text/html",
    markdown: "text/markdown",
    md: "text/markdown",
    odp: "application/vnd.oasis.opendocument.presentation",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odt: "application/vnd.oasis.opendocument.text",
    pdf: "application/pdf",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    rtf: "application/rtf",
    text: "text/plain",
    txt: "text/plain",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return byExtension[extension] ?? "application/octet-stream";
}

async function prepareDocument(
  root: string,
  document: NonNullable<WorkspaceBlueprint["documents"]>[number],
) {
  if (!document.file) {
    const content = document.content ?? "";
    return {
      key: document.key,
      content,
      paragraphs: segmentParagraphs(content),
      fileType: "text",
    } satisfies PreparedDocument;
  }

  const path = await safePackagePath(root, document.file);
  const info = await stat(path);
  if (!info.isFile()) throw new Error("Document path is not a file.");
  if (info.size > MAX_PACKAGE_FILE_BYTES) throw new Error("Documents must be 10 MB or smaller.");
  const data = await readFile(path);
  const fileName = basename(path);
  const contentType = contentTypeForDocument(fileName);
  const file = new File([data], fileName, { type: contentType });
  validateDocumentFile(file);
  const extracted = document.content ?? (await extractDocumentTextCore(file));
  if (!extracted?.trim()) throw new Error("No readable text could be extracted from the document.");
  return {
    key: document.key,
    content: extracted.trim(),
    paragraphs: segmentParagraphs(extracted),
    fileType: documentFileType(file),
    upload: { data, contentType, fileName },
  } satisfies PreparedDocument;
}

async function prepareAsset(
  root: string,
  asset: NonNullable<WorkspaceBlueprint["assets"]>[number],
) {
  const path = await safePackagePath(root, asset.file);
  const info = await stat(path);
  if (!info.isFile()) throw new Error("Asset path is not a file.");
  if (info.size > MAX_PACKAGE_FILE_BYTES) throw new Error("Images must be 10 MB or smaller.");
  const data = await readFile(path);
  const metadata = await sharp(data).metadata();
  const mimeType = metadata.format ? ASSET_MIME_BY_SHARP_FORMAT[metadata.format] : null;
  if (!mimeType) throw new Error("Use a PNG, JPEG, WebP, GIF, or AVIF image.");
  return {
    key: asset.key,
    data,
    originalFileName: basename(path).slice(0, 255),
    mimeType,
    fileSizeBytes: info.size,
    widthPixels: metadata.width ?? null,
    heightPixels: metadata.height ?? null,
  } satisfies PreparedAsset;
}

export async function preflightWorkspacePackage(
  packageDirectory: string,
): Promise<WorkspacePackagePreflight> {
  const root = await realpath(resolve(packageDirectory));
  const raw = JSON.parse(await readFile(resolve(root, "blueprint.json"), "utf8")) as unknown;
  const blueprintReport = preflightWorkspaceBlueprint(raw);
  const issues = [...blueprintReport.issues];
  if (!blueprintReport.blueprint) {
    return { ok: false, blueprint: blueprintReport, issues, prepared: null };
  }
  const blueprint = blueprintReport.blueprint;

  const documents: PreparedDocument[] = [];
  for (const [index, document] of (blueprint.documents ?? []).entries()) {
    try {
      const prepared = await prepareDocument(root, document);
      if (prepared.paragraphs.length === 0) throw new Error("Document has no citation-ready paragraphs.");
      documents.push(prepared);
    } catch (error) {
      issues.push(packageIssue(`documents.${index}.file`, error instanceof Error ? error.message : "Could not read document."));
    }
  }

  const assets: PreparedAsset[] = [];
  for (const [index, asset] of (blueprint.assets ?? []).entries()) {
    try {
      assets.push(await prepareAsset(root, asset));
    } catch (error) {
      issues.push(packageIssue(`assets.${index}.file`, error instanceof Error ? error.message : "Could not read asset."));
    }
  }

  const templateBundles: PreparedTemplateBundle[] = [];
  for (const [index, template] of (blueprint.templateBundles ?? []).entries()) {
    try {
      const directory = await safePackagePath(root, template.directory);
      const bundle = await loadTemplateBundleDirectory(directory);
      const report = await preflightTemplateBundle({
        manifest: bundle.manifest,
        assets: bundle.assets,
      });
      if (!report.ok) {
        report.issues
          .filter((entry) => entry.severity === "error")
          .forEach((entry) => issues.push(packageIssue(`templateBundles.${index}.${entry.path}`, entry.message)));
      } else {
        templateBundles.push({
          key: template.key,
          assignToProducts: template.assignToProducts,
          bundle,
        });
      }
    } catch (error) {
      issues.push(packageIssue(`templateBundles.${index}.directory`, error instanceof Error ? error.message : "Could not read template bundle."));
    }
  }

  const prepared: PreparedWorkspacePackage = {
    root,
    blueprint,
    blueprintSha256: workspacePackageSha256({
      blueprint,
      artifacts: [
        ...documents.flatMap((document) =>
          document.upload
            ? [{ kind: "document", key: document.key, path: document.upload.fileName, sha256: bytesSha256(document.upload.data) }]
            : [],
        ),
        ...assets.map((asset) => ({
          kind: "asset",
          key: asset.key,
          path: asset.originalFileName,
          sha256: bytesSha256(asset.data),
        })),
        ...templateBundles.flatMap((template) => [
          {
            kind: "template-manifest",
            key: template.key,
            path: "manifest.json",
            sha256: blueprintSha256(template.bundle.manifest),
          },
          ...template.bundle.assets.map((asset) => ({
            kind: "template-asset",
            key: template.key,
            path: asset.path,
            sha256: bytesSha256(asset.data),
          })),
        ]),
      ],
    }),
    documents,
    assets,
    templateBundles,
  };
  return { ok: issues.length === 0, blueprint: blueprintReport, issues, prepared: issues.length === 0 ? prepared : null };
}
