import { createHash } from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function blueprintSha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function bytesSha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function workspacePackageSha256(input: {
  blueprint: unknown;
  artifacts: Array<{ kind: string; key: string; path: string; sha256: string }>;
}) {
  return blueprintSha256({
    blueprint: input.blueprint,
    artifacts: [...input.artifacts].sort((left, right) =>
      `${left.kind}:${left.key}:${left.path}`.localeCompare(
        `${right.kind}:${right.key}:${right.path}`,
      ),
    ),
  });
}
