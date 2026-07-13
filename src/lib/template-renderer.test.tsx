import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";
import { ImageResponse } from "next/og";

import { TEMPLATE_LAYOUT_CONTRACTS } from "./template-contract";
import { renderContractTemplate } from "./template-renderer";

const STRESS_COPY = Array.from(
  { length: 90 },
  (_, index) => `evidence-based-word-${index}`
).join(" ");

const EXPECTED_RATIOS = {
  square: 1,
  story: 9 / 16,
  feed: 1200 / 630,
  a4: 1 / Math.SQRT2,
} as const;

test("renders worst-case copy for every active layout and output size", async () => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (!pathname.startsWith("/assets/")) {
        response.writeHead(404).end();
        return;
      }
      const file = await readFile(join(process.cwd(), "public", pathname));
      response.writeHead(200, {
        "Content-Type": pathname.endsWith(".png") ? "image/png" : "image/jpeg",
      });
      response.end(file);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const origin = `http://127.0.0.1:${address.port}`;

    for (const contract of Object.values(TEMPLATE_LAYOUT_CONTRACTS)) {
      const fields = Object.fromEntries(
        contract.editableFields.map((field) => [
          field,
          `${STRESS_COPY}\n${STRESS_COPY}\n${STRESS_COPY}\n${STRESS_COPY}`,
        ])
      );
      for (const sizeKey of contract.sizes) {
        const rendered = await renderContractTemplate({
          layoutKey: contract.layoutKey,
          sizeKey,
          fields,
          disclaimer: STRESS_COPY,
          origin,
        });
        assert.ok(rendered, `${contract.layoutKey}/${sizeKey} did not render`);
        assert.ok(rendered.w > 0 && rendered.h > 0);
        assert.ok(
          Math.abs(rendered.w / rendered.h - EXPECTED_RATIOS[sizeKey]) < 0.02,
          `${contract.layoutKey}/${sizeKey} returned unexpected dimensions`
        );

        const image = new ImageResponse(rendered.element, {
          width: rendered.w,
          height: rendered.h,
          fonts: rendered.fonts,
        });
        const bytes = new Uint8Array(await image.arrayBuffer());
        assert.ok(bytes.length > 5_000, `${contract.layoutKey}/${sizeKey} returned a blank image`);
        assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
