import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const migrationFiles = [
  "20260714183000_template_platform_v1_foundation.sql",
  "20260714190000_template_bundle_storage.sql",
];

async function main() {
  const outputDirectory = join(process.cwd(), ".template-bundles");
  const outputPath = join(outputDirectory, "template-platform-migrations.sql");
  const chunks = await Promise.all(
    migrationFiles.map(async (file) => {
      const sql = await readFile(join(process.cwd(), "supabase", "migrations", file), "utf8");
      return [`-- ${file}`, sql.trim(), ""].join("\n");
    })
  );

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${chunks.join("\n")}\n`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
