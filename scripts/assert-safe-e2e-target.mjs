import { pathToFileURL } from "node:url";

const PRODUCTION_HOSTS = new Set([
  "contentgate.app",
  "www.contentgate.app",
  "contentgate-delta.vercel.app",
]);

export function isProductionHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    PRODUCTION_HOSTS.has(normalized) ||
    normalized.endsWith(".contentgate.app")
  );
}

export function assertSafeE2ETarget(value) {
  if (!value) {
    throw new Error(
      "Pass a non-production base URL or set CONTENTGATE_E2E_BASE_URL."
    );
  }

  let target;
  try {
    target = new URL(value);
  } catch {
    throw new Error(`Invalid E2E base URL: ${value}`);
  }

  if (target.username || target.password) {
    throw new Error("E2E base URLs must not contain credentials.");
  }

  const localTarget = ["localhost", "127.0.0.1", "::1"].includes(
    target.hostname
  );
  if (target.protocol !== "https:" && !(localTarget && target.protocol === "http:")) {
    throw new Error("E2E targets must use HTTPS, except for local development.");
  }

  if (isProductionHost(target.hostname)) {
    throw new Error(
      `Refusing stateful E2E against production host ${target.hostname}. Use a preview or dedicated QA environment.`
    );
  }

  return target.origin;
}

function main() {
  const value = process.argv[2] || process.env.CONTENTGATE_E2E_BASE_URL;
  const origin = assertSafeE2ETarget(value);
  console.log(`Stateful E2E target approved: ${origin}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
