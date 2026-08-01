import { assertSafeE2ETarget, isProductionHost } from "../../scripts/assert-safe-e2e-target.mjs";

export default function globalSetup() {
  const value =
    process.env.CONTENTGATE_E2E_BASE_URL ?? "http://localhost:3000";
  const target = new URL(value);
  const approvedAskProductionValidation =
    process.env.CI === "true" &&
    process.env.CONTENTGATE_E2E_VALIDATION_RUN === "1" &&
    target.hostname === "contentgate-delta.vercel.app";

  if (isProductionHost(target.hostname) && approvedAskProductionValidation) {
    return;
  }

  assertSafeE2ETarget(value);
}
