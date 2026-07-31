import { NextResponse } from "next/server";
import {
  getAuthConfirmationDestination,
  isEmailOtpType,
} from "@/lib/auth-confirm";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const destination = getAuthConfirmationDestination(
        url.searchParams.get("next"),
        type
      );
      return NextResponse.redirect(new URL(destination, url.origin));
    }
  }

  const failurePath =
    type === "recovery"
      ? "/reset-password?error=invalid"
      : "/login?error=auth";
  return NextResponse.redirect(new URL(failurePath, url.origin));
}
