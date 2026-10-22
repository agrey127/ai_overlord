import { createClient } from "@supabase/supabase-js";
import { synchronizeRuns } from "../lib/garmin/sync";

async function main() {
  const env = process.env;
  const owner = env.GARMIN_PERSONAL_USER_ID?.trim();
  const key = env.GARMIN_PERSONAL_API_KEY?.trim();
  const cutoff = env.GARMIN_AUTO_SYNC_START_AT;
  const secret = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!owner || owner !== env.DAILY_DIGEST_USER_ID || !key || !cutoff || !secret || !env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Automatic sync configuration is incomplete or owner mapping does not match.");
  }
  const options = new Map(process.argv.slice(2).map((argument) => {
    const index = argument.indexOf("=");
    return [argument.slice(0, index), argument.slice(index + 1)];
  }));
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await synchronizeRuns(supabase, owner, key, cutoff, new Date().toISOString(),
    options.get("--last-success"), options.get("--last-full"));
  console.log(JSON.stringify(result));
}

const deadline = setTimeout(() => {
  console.error("Garmin automatic sync timed out; it will retry.");
  process.exit(1);
}, 9 * 60 * 1000);

main().finally(() => clearTimeout(deadline)).catch(() => {
  // Never log an SDK error, raw payload, key, owner, or token in timer journals.
  console.error("Garmin automatic sync failed. Check configuration, key expiration, and connectivity. The next scheduled run will retry.");
  process.exitCode = 1;
});
