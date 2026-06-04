import { NextResponse } from "next/server";
import { StockSyncService } from "@/lib/stock-sync-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await StockSyncService.getStatus();

    const serialized = {
      lastSync: status.lastSync
        ? {
            id:           status.lastSync.id,
            startedAt:    status.lastSync.startedAt.toISOString(),
            completedAt:  status.lastSync.completedAt?.toISOString() ?? null,
            status:       status.lastSync.status,
            stocksUpdated:status.lastSync.stocksUpdated,
            errorMessage: status.lastSync.errorMessage,
          }
        : null,
      totalStocks: status.totalStocks,
      gainers:     status.gainers,
      losers:      status.losers,
      isRunning:   status.isRunning,
    };

    return NextResponse.json(serialized);
  } catch (err) {
    console.error("[GET /api/stocks/sync/status]", err);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}
