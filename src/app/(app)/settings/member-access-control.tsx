"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/invites";
import { changeMemberRole, disableMember, restoreMember } from "./actions";

const ROLE_LABELS: Record<InvitableRole, string> = {
  member: "Member",
  approver: "Approver",
  admin: "Admin",
};

export function MemberAccessControl({
  memberId,
  memberLabel,
  role: initialRole,
  status,
  sessionVerified,
}: {
  memberId: string;
  memberLabel: string;
  role: InvitableRole;
  status: "active" | "invited" | "disabled";
  sessionVerified: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [pending, startTransition] = useTransition();

  if (!sessionVerified) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/mfa">Verify MFA to manage</Link>
      </Button>
    );
  }

  function updateRole(nextRole: string) {
    if (nextRole === role) return;
    const previousRole = role;
    setRole(nextRole as InvitableRole);
    startTransition(async () => {
      try {
        const result = await changeMemberRole(memberId, nextRole);
        if ("error" in result) {
          setRole(previousRole);
          toast.error(result.error);
          return;
        }
        toast.success(
          `${memberLabel}’s role changed to ${ROLE_LABELS[nextRole as InvitableRole]}.`
        );
        router.refresh();
      } catch {
        setRole(previousRole);
        toast.error("Could not change this member’s role.");
      }
    });
  }

  function changeAccess() {
    startTransition(async () => {
      try {
        const result =
          status === "disabled"
            ? await restoreMember(memberId)
            : await disableMember(memberId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        if (result.warning) toast.warning(result.warning);
        else {
          toast.success(
            status === "disabled"
              ? `${memberLabel} can sign in again.`
              : status === "invited"
                ? `${memberLabel}’s invitation is disabled.`
                : `${memberLabel} no longer has workspace access.`
          );
        }
        router.refresh();
      } catch {
        toast.error("Could not update this member’s access.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={role}
        onValueChange={updateRole}
        disabled={pending || status === "disabled"}
      >
        <SelectTrigger
          size="sm"
          className="min-w-28"
          aria-label={`Role for ${memberLabel}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INVITABLE_ROLES.map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={status === "disabled" ? "outline" : "destructive"}
        onClick={changeAccess}
        disabled={pending}
      >
        {pending
          ? "Updating…"
          : status === "disabled"
            ? "Restore"
            : status === "invited"
              ? "Cancel invite"
              : "Disable"}
      </Button>
    </div>
  );
}
