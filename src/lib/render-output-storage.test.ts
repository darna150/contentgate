import assert from "node:assert/strict";
import test from "node:test";

import { renderOutputStoragePath } from "./render-output-storage.ts";

test("render output storage paths are scoped to org, content, revision, and input hash", () => {
  assert.equal(
    renderOutputStoragePath({
      orgId: "org-123",
      contentId: "content-456",
      revision: 7,
      variantKey: "Billboard 970×250",
      format: "png",
      inputSha256:
        "abcdef012345abcdef012345abcdef012345abcdef012345abcdef012345abcd",
      extension: "png",
    }),
    "org-123/content-456/revision-7/billboard-970-250-png-abcdef012345.png"
  );
});
