import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { NewsSyncService } from "@/lib/news-sync-service";

/**
 * GET /api/news/sync/status
 *
 * Returns last sync information + total article count + running flag.
 * Used by the dashboard widgets and the Sync Now button.
 */
export async function GET() {
  try {
    const status = await NewsSyncService.getStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get status";
    console.error("[GET /api/news/sync/status]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
