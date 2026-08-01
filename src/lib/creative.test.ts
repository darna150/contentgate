import assert from "node:assert/strict";
import test from "node:test";

import { templateReferenceExportUrl } from "./studio-export.ts";
import { studioPreviewImageSources } from "./studio-preview-images.ts";

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

test("Studio paints a static reference immediately and upgrades it independently", () => {
  assert.deepEqual(
    studioPreviewImageSources({
      src: "/template-previews/nimbus-air-campaign/instagram-post-portrait.png?v=1",
      highResolutionSrc:
        "/api/creative/template-preview?assignment=assignment-1&size=instagram-post-portrait",
    }),
    {
      instantSrc:
        "/template-previews/nimbus-air-campaign/instagram-post-portrait.png?v=1",
      highResolutionSrc:
        "/api/creative/template-preview?assignment=assignment-1&size=instagram-post-portrait",
    }
  );
});

test("generated previews request 2x only after their normal preview", () => {
  assert.deepEqual(
    studioPreviewImageSources({
      src: "/api/creative/draft-preview?content=content-1&size=portrait&v=2",
    }),
    {
      instantSrc:
        "/api/creative/draft-preview?content=content-1&size=portrait&v=2",
      highResolutionSrc:
        "/api/creative/draft-preview?content=content-1&size=portrait&v=2&scale=2",
    }
  );
});
