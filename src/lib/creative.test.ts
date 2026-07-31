import assert from "node:assert/strict";
import test from "node:test";

import { templateReferenceExportUrl } from "./studio-export.ts";

test("reference exports use the full-resolution renderer instead of a static preview", () => {
  assert.equal(
    templateReferenceExportUrl({
      templateId: "platform:assignment-1",
      platformAssignmentId: "assignment-1",
      size: "linkedin-post-square",
    }),
    "/api/creative/template-preview?assignment=assignment-1&size=linkedin-post-square"
  );
});
