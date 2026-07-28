import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

if (process.env.ASK_PURGE_CONFIRM !== "1") {
  throw new Error("Set ASK_PURGE_CONFIRM=1 to purge expired Ask operational data.");
}

const days = Number(process.env.ASK_TELEMETRY_RETENTION_DAYS ?? "90");
if (!Number.isInteger(days) || days < 30 || days > 3650) {
  throw new Error("ASK_TELEMETRY_RETENTION_DAYS must be an integer between 30 and 3650.");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service role key are required.");

const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
const supabase = createClient(url, serviceRoleKey);
const { error } = await supabase.from("knowledge_queries").delete().lt("created_at", cutoff);
if (error) throw new Error(`Could not purge Ask data: ${error.message}`);
console.log(`Purged Ask query records created before ${cutoff}.`);
