"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { enableAdminMfaRequirement } from "./actions";

export function MfaRequirementControl({
  required,
  sessionVerified,
}: {
  required: boolean;
  sessionVerified: boolean;
}) {
  const [busy, setBusy] = useState(false);

  if (required) {
    return (
      <p className="text-small font-semibold text-approve" role="status">
        Administrator MFA is required for this workspace.
      </p>
    );
  }

  if (!sessionVerified) {
    return (
      <Button asChild>
        <Link href="/mfa">Set up and verify MFA</Link>
      </Button>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const result = await enableAdminMfaRequirement();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Administrator MFA is now required for this workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={enable} disabled={busy}>
      {busy ? "Enabling…" : "Require MFA for all admins"}
    </Button>
  );
}
