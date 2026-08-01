import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const appRoot = resolve(root, "src/app");
const manifestPath = resolve(root, "tests/accessibility-pages.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

async function pageFiles(directory) {
  const entries = await readdir(directory);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry);
      return (await stat(path)).isDirectory()
        ? pageFiles(path)
        : entry === "page.tsx"
          ? [relative(root, path).split(sep).join("/")]
          : [];
    }),
  );
  return nested.flat();
}

const actualPages = (await pageFiles(appRoot)).sort();
const declaredPages = manifest.map((entry) => entry.source).sort();
const duplicates = declaredPages.filter((source, index) => declaredPages.indexOf(source) !== index);
const missing = actualPages.filter((source) => !declaredPages.includes(source));
const stale = declaredPages.filter((source) => !actualPages.includes(source));
const invalid = manifest.filter(
  (entry) =>
    typeof entry.route !== "string" ||
    !entry.route.startsWith("/") ||
    typeof entry.access !== "string" ||
    typeof entry.gate !== "string" ||
    !Array.isArray(entry.states) ||
    entry.states.length === 0 ||
    entry.states.some((state) => typeof state !== "string" || state.trim() === ""),
);

if (duplicates.length || missing.length || stale.length || invalid.length) {
  const lines = ["Accessibility page coverage contract failed."];
  if (duplicates.length) lines.push(`Duplicate entries: ${[...new Set(duplicates)].join(", ")}`);
  if (missing.length) lines.push(`Pages without coverage: ${missing.join(", ")}`);
  if (stale.length) lines.push(`Coverage entries without pages: ${stale.join(", ")}`);
  if (invalid.length) lines.push(`Invalid entries: ${invalid.map((entry) => entry.source).join(", ")}`);
  throw new Error(lines.join("\n"));
}

console.log(`Accessibility coverage declared for all ${actualPages.length} UI routes.`);
