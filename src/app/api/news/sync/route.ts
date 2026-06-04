import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  NewsSyncService,
  SyncAlreadyRunningError,
} from "@/lib/news-sync-service";

// POST /api/news/sync
// Triggers an immediate news sync. Returns 409 if a sync is already running.
// Sync triggers: Sync Now button, Vercel Cron (vercel.json), GitHub Actions, VPS crontab.
export async function POST() {
  try {
    const result = await NewsSyncService.sync();

    return NextResponse.json(
      {
        success: true,
        syncLogId: result.syncLogId,
        articlesFetched: result.articlesFetched,
        articlesCreated: result.articlesCreated,
        durationMs: result.durationMs,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof SyncAlreadyRunningError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 409 }
      );
    }

    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("[POST /api/news/sync]", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
