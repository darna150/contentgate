import "server-only";

import { loadAdminMfaContext } from "../auth/admin-mfa";
import { adminMfaSatisfied } from "../auth/admin-mfa-policy";
import { isPlatformOperator } from "./environment";

export class PlatformOperatorMfaRequiredError extends Error {
  constructor() {
    super("Platform operator MFA verification is required.");
    this.name = "PlatformOperatorMfaRequiredError";
  }
}

export async function requirePlatformOperator() {
  const context = await loadAdminMfaContext();
  if (!context || !isPlatformOperator(context.email)) {
    throw new Error("Platform operator access is required.");
  }
  if (
    !adminMfaSatisfied({
      role: context.role,
      required: context.required,
      currentLevel: context.currentLevel,
      alwaysRequireAal2: true,
    })
  ) {
    throw new PlatformOperatorMfaRequiredError();
  }
  return { userId: context.userId, email: context.email };
}

export function assertOperatorPackagePath(userId: string, storagePath: string) {
  if (!storagePath.startsWith(`${userId}/`) || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("The staged package does not belong to this operator.");
  }
}
