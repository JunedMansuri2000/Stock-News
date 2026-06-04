import { NextResponse } from "next/server";
import { StockSyncService, SyncAlreadyRunningError } from "@/lib/stock-sync-service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { syncLogId } = await StockSyncService.sync();
    return NextResponse.json({
      success: true,
      syncLogId,
      message: "Sync started — data updates in the background. Watch the status widgets.",
    });
  } catch (err) {
    if (err instanceof SyncAlreadyRunningError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/stocks/sync]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
