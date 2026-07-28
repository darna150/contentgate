import assert from "node:assert/strict";
import test from "node:test";

import { safeUiUxMeasurementProperties } from "./uiux-measurement-contract.ts";

test("UI/UX telemetry keeps only allowlisted scalar metadata", () => {
  assert.deepEqual(
    safeUiUxMeasurementProperties("studio_generation_completed", {
      duration_ms: 1250,
      outcome: "success",
      copy: "must never be retained",
      source_text: "must never be retained",
      content_id: "not needed for pilot metrics",
      nested: { unsafe: true } as unknown as string,
    }),
    { duration_ms: 1250, outcome: "success" },
  );
});
