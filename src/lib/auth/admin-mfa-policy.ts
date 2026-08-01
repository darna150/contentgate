export type AssuranceLevel = "aal1" | "aal2" | (string & {}) | null;

export function adminMfaSatisfied(input: {
  role: string | null | undefined;
  required: boolean;
  currentLevel: AssuranceLevel;
  alwaysRequireAal2?: boolean;
}) {
  if (input.role !== "admin") return false;
  if (!input.required && !input.alwaysRequireAal2) return true;
  return input.currentLevel === "aal2";
}
