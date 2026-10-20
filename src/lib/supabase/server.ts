import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for trusted server-side work (ingestion jobs, admin
 * tasks). This bypasses RLS entirely, so it must never be imported into
 * anything that runs in the browser or handles a single request on behalf
 * of a specific org — use `createRequestClient` for that instead.
 */
export function createServiceClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Per-request client scoped to the caller's JWT, so RLS policies apply
 * normally. Use this in API routes that act on behalf of a signed-in org
 * member.
 */
export function createRequestClient(accessToken: string) {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
