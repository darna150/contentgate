import "server-only";

import { createClient } from "../supabase/server";
import { isPlatformOperator } from "./environment";

export async function requirePlatformOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformOperator(user.email)) {
    throw new Error("Platform operator access is required.");
  }
  return { userId: user.id, email: user.email ?? null };
}

export function assertOperatorPackagePath(userId: string, storagePath: string) {
  if (!storagePath.startsWith(`${userId}/`) || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new Error("The staged package does not belong to this operator.");
  }
}
