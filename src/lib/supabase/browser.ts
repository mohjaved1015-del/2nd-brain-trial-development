import { createClient } from "@supabase/supabase-js";

/**
 * Browser client for the signed-in user's own session (auth flows, reading
 * data covered by RLS). Only the public URL and anon key are used here —
 * never the service-role key.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
}
