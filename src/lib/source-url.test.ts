import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isBlockedNetworkAddress,
  normalizeSourceUrl,
  readableTextFromHtml,
} from "./source-url-shared.ts";

test("normalizes public source URLs and removes fragments", () => {
  assert.equal(
    normalizeSourceUrl(" https://example.com/brand?region=ph#overview "),
    "https://example.com/brand?region=ph"
  );
});

test("rejects local, credentialed, and non-web URLs", () => {
  assert.throws(() => normalizeSourceUrl("http://localhost/admin"));
  assert.throws(() => normalizeSourceUrl("https://user:secret@example.com"));
  assert.throws(() => normalizeSourceUrl("file:///etc/passwd"));
});

test("blocks private and metadata network addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.4", "169.254.169.254", "192.168.1.1", "::1", "fd00::1"]) {
    assert.equal(isBlockedNetworkAddress(address), true, address);
  }
  assert.equal(isBlockedNetworkAddress("8.8.8.8"), false);
  assert.equal(isBlockedNetworkAddress("2606:4700:4700::1111"), false);
});

test("extracts readable paragraphs and removes executable page chrome", () => {
  const html = `
    <html><head><title>Aerform &amp; AIR 01</title><style>.x{}</style></head>
    <body><nav>Skip this menu</nav><main><h1>AIR 01</h1><p>Approved product detail.</p>
    <ul><li>Lightweight</li><li>Travel ready</li></ul><script>ignore()</script></main></body></html>`;
  const text = readableTextFromHtml(html);

  assert.match(text, /AIR 01/);
  assert.match(text, /Approved product detail\./);
  assert.match(text, /• Lightweight/);
  assert.doesNotMatch(text, /Skip this menu|ignore/);
});
