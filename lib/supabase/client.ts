import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Browser client — uses the public anon key and is always subject to RLS.
// Safe to import into client components.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
