import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";
import { ImageResponse } from "next/og";
import { renderToStaticMarkup } from "react-dom/server";

import {
  auditPublishedTemplateFrameVisuals,
  publishedTemplateFrameUsesVectorLayers,
  renderPublishedTemplatePackage,
} from "./published-template-package";
import { TEMPLATE_LAYOUT_CONTRACTS } from "./template-contract";
import { renderContractTemplate } from "./template-renderer";

const STRESS_COPY = Array.from(
  { length: 90 },
  (_, index) => `evidence-based-word-${index}`
).join(" ");

const EXPECTED_RATIOS = {
  square: 1,
  portrait: 1080 / 1350,
  story: 9 / 16,
  linkedin_square: 1,
  feed: 1200 / 630,
  link_ad: 1200 / 628,
  leaderboard: 728 / 90,
  medium_rectangle: 300 / 250,
  a4: 1 / Math.SQRT2,
  us_letter: 816 / 1056,
  poster: 900 / 1350,
  rack_card: 440 / 864,
} as const;

test("renders worst-case copy for every active layout and output size", async () => {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (
        !pathname.startsWith("/assets/") &&
        !pathname.startsWith("/template-packages/")
      ) {
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

test("ContentGate generated frames include locked surfaces for white editable text", () => {
  for (const layoutKey of [
    "contentgate_local_friendly",
    "contentgate_local_premium",
  ]) {
    const contract = TEMPLATE_LAYOUT_CONTRACTS[layoutKey];
    assert.ok(contract);
    for (const sizeKey of contract.sizes) {
      assert.deepEqual(
        auditPublishedTemplateFrameVisuals(layoutKey, sizeKey),
        [],
        `${layoutKey}/${sizeKey} has unsafe editable text surfaces`
      );
    }
  }
});

test("ContentGate generated vector frames avoid mixed raster backgrounds", () => {
  for (const layoutKey of [
    "contentgate_local_friendly",
    "contentgate_local_premium",
  ]) {
    const contract = TEMPLATE_LAYOUT_CONTRACTS[layoutKey];
    assert.ok(contract);
    for (const sizeKey of contract.sizes) {
      if (!publishedTemplateFrameUsesVectorLayers(layoutKey, sizeKey)) continue;
      const rendered = renderPublishedTemplatePackage({
        layoutKey,
        sizeKey,
        origin: "http://localhost",
        original: false,
        disclaimer: "",
        fields: Object.fromEntries(
          contract.editableFields.map((field) => [field, "Safe copy"])
        ),
      });
      assert.ok(rendered, `${layoutKey}/${sizeKey} did not render`);
      const html = renderToStaticMarkup(rendered.element);
      if (html.includes("data-template-field")) {
        assert.doesNotMatch(
          html,
          /backgrounds\//,
          `${layoutKey}/${sizeKey} mixed editable fields with a raster background`
        );
        assert.match(
          html,
          /overflow:hidden/,
          `${layoutKey}/${sizeKey} editable fields are not clipped`
        );
      }
    }
  }
});
