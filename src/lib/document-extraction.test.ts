import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_DOCUMENT_BYTES,
  documentFileType,
  validateDocumentFile,
} from "./document-files.ts";

function fakeFile(name: string, size: number, type = "") {
  return { name, size, type } as File;
}

test("normalizes supported document upload content types", () => {
  assert.equal(
    validateDocumentFile(fakeFile("approved-guide.DOCX", 1024)),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(validateDocumentFile(fakeFile("claims.md", 1024)), "text/markdown");
  assert.equal(documentFileType(fakeFile("claims.md", 1024)), "md");
});

test("rejects unsupported and oversized document uploads", () => {
  assert.throws(
    () => validateDocumentFile(fakeFile("archive.exe", 1024)),
    /Use PDF/
  );
  assert.throws(
    () => validateDocumentFile(fakeFile("large.pdf", MAX_DOCUMENT_BYTES + 1)),
    /10 MB or smaller/
  );
});
