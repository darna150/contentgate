"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/invites";
import { inviteMember } from "./actions";

const ROLE_LABELS: Record<InvitableRole, string> = {
  member: "Member — generates and edits content",
  approver: "Approver — reviews and approves content",
  admin: "Admin — full workspace administration",
};

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("full_name", fullName);
      formData.set("role", role);
      const result = await inviteMember(formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invite sent to ${result.email}.`);
      setEmail("");
      setFullName("");
      setRole("member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email">Work email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-name">Full name (optional)</Label>
          <Input
            id="invite-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Sam Vetson"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(value) => setRole(value as InvitableRole)}>
          <SelectTrigger id="invite-role" className="w-full sm:max-w-md">
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
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending invite…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
