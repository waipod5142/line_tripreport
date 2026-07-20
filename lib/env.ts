import "server-only";
import { z } from "zod";

// Server-side environment validation (PRD §22). Parsed lazily and memoized so a
// missing secret fails fast at first request rather than silently, without
// breaking builds that don't have every secret present.

const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  AI_PROVIDER: z.string().default("openrouter"),
  OPENROUTER_API_KEY: z.string().min(1),
  AI_MODEL: z.string().default("moonshotai/kimi-k3"),
  OPENROUTER_APP_URL: z.string().url().optional(),
  OPENROUTER_APP_TITLE: z.string().optional(),
  INTERNAL_JOB_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
