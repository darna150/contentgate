import crypto from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";

import {
  checkOnboardingEnvironment,
  currentOnboardingEnvironmentInput,
} from "../src/lib/onboarding/environment.ts";

const action = process.argv[2];
const email = process.argv[3]?.trim().toLowerCase();
const organizationIdArgument = process.argv[4]?.trim();

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  if (!email || !email.includes("@")) {
    throw new Error("A disposable QA email address is required.");
  }
  if (action !== "create" && action !== "delete") {
    throw new Error("Usage: tsx scripts/disposable-recovery-qa.ts <create|delete> <email>");
  }

  const environment = checkOnboardingEnvironment(
    currentOnboardingEnvironmentInput({ workspaceKey: "disposable-recovery-qa" })
  );
  if (!environment.ok || environment.target !== "staging") {
    throw new Error(
      [
        "Disposable recovery QA is staging-only.",
        ...environment.errors,
      ].join("\n")
    );
  }

  const admin = createClient(
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  async function resolveOrganizationId() {
    if (organizationIdArgument) return organizationIdArgument;

    const qaOwnerEmail = process.env.CONTENTGATE_E2E_EMAIL?.trim().toLowerCase();
    if (!qaOwnerEmail) {
      throw new Error(
        "Creating a disposable recovery user requires either an organization ID as the fourth argument or CONTENTGATE_E2E_EMAIL for an existing staging user."
      );
    }

    const { data, error } = await admin.rpc("find_onboarding_user_by_email", {
      p_email: qaOwnerEmail,
    });
    if (error) throw error;
    const owner = Array.isArray(data) ? data[0] : data;
    const organizationId = owner?.organization_id as string | null | undefined;
    if (!organizationId) {
      throw new Error(
        `${qaOwnerEmail} must already belong to a staging workspace before it can anchor recovery QA.`
      );
    }
    return organizationId;
  }

  async function findUserByEmail(targetEmail: string): Promise<User | null> {
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      if (error) throw error;
      const user = data.users.find(
        (candidate) => candidate.email === targetEmail
      );
      if (user) return user;
      if (data.users.length < 100) return null;
    }
    throw new Error("User lookup exceeded 1,000 staging users.");
  }

  const existing = await findUserByEmail(email);
  if (action === "delete") {
    if (!existing) {
      console.log(JSON.stringify({ action, email, status: "already_absent" }));
      return;
    }
    const { error } = await admin.auth.admin.deleteUser(existing.id, false);
    if (error) throw error;
    console.log(
      JSON.stringify({ action, email, userId: existing.id, status: "deleted" })
    );
    return;
  }

  if (existing) {
    console.log(
      JSON.stringify({ action, email, userId: existing.id, status: "existing" })
    );
    return;
  }

  const organizationId = await resolveOrganizationId();
  const { error: provisionError } = await admin.rpc("provision_user", {
    provision_email: email,
    provision_org_id: organizationId,
    provision_role: "member",
    provision_full_name: "Disposable Recovery QA",
  });
  if (provisionError) throw provisionError;

  const password = `CgQA-${crypto.randomBytes(18).toString("base64url")}!7`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Disposable Recovery QA" },
  });
  if (error) throw error;
  if (!data.user) throw new Error("Supabase did not return the created QA user.");
  console.log(
    JSON.stringify({ action, email, userId: data.user.id, status: "created" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
