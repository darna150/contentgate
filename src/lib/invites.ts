// Invite input rules shared by the settings action and its tests. Email
// normalization must match the private.user_provisioning constraint
// (email = lower(trim(email))) or the handshake insert is rejected.

export const INVITABLE_ROLES = ["member", "approver", "admin"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: unknown): value is InvitableRole {
  return (
    typeof value === "string" &&
    (INVITABLE_ROLES as readonly string[]).includes(value)
  );
}

export function normalizeInviteEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return null;
  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }
  if (/\s/.test(email)) return null;
  return email;
}
