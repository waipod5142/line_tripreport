import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { isInternalRequest } from "@/lib/internal-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestFromArchive } from "@/lib/shipments/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-run the stage keyword rules over the archive for every imported shipment,
 * in every organization. Run it after changing lib/shipments/extract.ts.
 * Idempotent: existing events — including confirmed and rejected ones — are
 * never modified; only newly matching (message, stage) pairs are added.
 *
 * Authenticated with INTERNAL_JOB_SECRET. Not scheduled.
 */
export async function POST(req: NextRequest) {
  const env = serverEnv();
  if (!isInternalRequest(req.headers, env.INTERNAL_JOB_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs, error } = await admin.from("organizations").select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, Awaited<ReturnType<typeof suggestFromArchive>>> = {};
  for (const { id } of orgs) {
    results[id] = await suggestFromArchive(admin, id);
  }
  console.info(JSON.stringify({ stage: "suggest_shipment_stages", results }));
  return NextResponse.json({ ok: true, results });
}
