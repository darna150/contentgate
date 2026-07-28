const baseUrl = (process.argv[2] || process.env.CONTENTGATE_BASE_URL || "").replace(
  /\/$/,
  ""
);

if (!baseUrl) {
  console.error("Pass a base URL or set CONTENTGATE_BASE_URL.");
  process.exit(1);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    ...options,
  });
  return response;
}

const health = await request("/api/health");
if (health.status !== 200) {
  throw new Error(`/api/health returned ${health.status}`);
}
const healthBody = await health.json();
if (healthBody.status !== "ok") {
  throw new Error(`/api/health returned ${JSON.stringify(healthBody)}`);
}

const login = await request("/login");
if (login.status !== 200) throw new Error(`/login returned ${login.status}`);
for (const header of ["content-security-policy", "x-content-type-options", "x-frame-options"]) {
  if (!login.headers.get(header)) throw new Error(`/login is missing ${header}`);
}

for (const path of ["/dashboard", "/ask", "/ask/quality"]) {
  const protectedPage = await request(path);
  if (![302, 303, 307, 308].includes(protectedPage.status)) {
    throw new Error(`${path} did not redirect (${protectedPage.status})`);
  }
  const location = protectedPage.headers.get("location") || "";
  if (!location.includes("/login")) {
    throw new Error(`${path} redirected to an unexpected location: ${location}`);
  }
}

for (const path of ["/api/products/ask", "/api/products/ask/feedback"]) {
  const protectedApi = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (protectedApi.status !== 401) {
    throw new Error(`${path} did not reject an unauthenticated request (${protectedApi.status})`);
  }
}

console.log(`Production smoke checks passed for ${baseUrl}.`);
