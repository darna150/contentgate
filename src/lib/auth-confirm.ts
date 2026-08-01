import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.has(value);
}

export function getAuthConfirmationDestination(
  requestedPath: string | null,
  type: EmailOtpType
) {
  const fallback =
    type === "recovery"
      ? "/reset-password"
      : type === "invite"
        ? "/welcome"
        : "/dashboard";

  if (
    !requestedPath ||
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//")
  ) {
    return fallback;
  }

  return requestedPath;
}

export function getAuthConfirmationPath(
  tokenHash: string | null,
  type: string | null,
  requestedPath: string | null
) {
  if (!tokenHash || !isEmailOtpType(type)) {
    return null;
  }

  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
  });
  if (requestedPath) {
    params.set("next", requestedPath);
  }

  return `/auth/confirm?${params.toString()}`;
}
