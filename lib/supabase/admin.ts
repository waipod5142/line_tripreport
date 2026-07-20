import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role client — BYPASSES RLS. Use ONLY in reviewed server-only
 * ingestion/worker paths (the LINE webhook and the processing job), never in
 * response to an interactive user request. It must never reach the browser.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
