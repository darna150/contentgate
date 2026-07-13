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

const protectedPage = await request("/dashboard");
if (![302, 303, 307, 308].includes(protectedPage.status)) {
  throw new Error(`/dashboard did not redirect (${protectedPage.status})`);
}
const location = protectedPage.headers.get("location") || "";
if (!location.includes("/login")) {
  throw new Error(`/dashboard redirected to an unexpected location: ${location}`);
}

console.log(`Production smoke checks passed for ${baseUrl}.`);
