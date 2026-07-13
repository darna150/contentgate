import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = fileURLToPath(
  new URL("../supabase/migrations/", import.meta.url)
);
const fileNames = (await readdir(migrationsDirectory)).filter((name) =>
  name.endsWith(".sql")
);
const errors = [];
const versions = new Set();
const names = new Set();

for (const fileName of fileNames.sort()) {
  const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(fileName);
  if (!match) {
    errors.push(`${fileName}: use YYYYMMDDHHMMSS_snake_case.sql`);
    continue;
  }

  const [, version, name] = match;
  if (versions.has(version)) errors.push(`${fileName}: duplicate migration version`);
  if (names.has(name)) errors.push(`${fileName}: duplicate migration name`);
  versions.add(version);
  names.add(name);

  const sql = await readFile(join(migrationsDirectory, fileName), "utf8");
  if (!sql.trim()) errors.push(`${fileName}: migration is empty`);
  if (/^(<{7}|={7}|>{7})/m.test(sql)) {
    errors.push(`${fileName}: unresolved merge conflict marker`);
  }
  if (/security\s+definer/i.test(sql) && !/set\s+search_path/i.test(sql)) {
    errors.push(`${fileName}: SECURITY DEFINER requires an explicit search_path`);
  }
}

if (fileNames.length === 0) errors.push("No Supabase migrations found");

if (errors.length > 0) {
  console.error(`Migration integrity check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`Migration integrity check passed (${fileNames.length} files).`);
