import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";
import { prisma } from "./prisma";

export interface StockSyncStarted {
  syncLogId: string;
}

export interface StockSyncStatus {
  lastSync: {
    id: string;
    startedAt: Date;
    completedAt: Date | null;
    status: string;
    stocksUpdated: number;
    errorMessage: string | null;
  } | null;
  totalStocks: number;
  gainers: number;
  losers: number;
  isRunning: boolean;
}

export class SyncAlreadyRunningError extends Error {
  constructor() {
    super("A stock sync is already in progress");
    this.name = "SyncAlreadyRunningError";
  }
}

export class StockSyncService {
  private static readonly STALE_RUNNING_MS = 10 * 60 * 1000;

  /**
   * Fires the Python sync in the background and returns immediately.
   * The caller does not need to wait — DB log is updated when Python finishes.
   */
  static async sync(): Promise<StockSyncStarted> {
    if (await this.isRunning()) {
      throw new SyncAlreadyRunningError();
    }

    const log = await prisma.stockSyncLog.create({ data: { status: "running" } });
    console.log(`[StockSync] Sync started in background (logId=${log.id})`);

    // Intentionally NOT awaited — runs independently after response is sent
    void this.runBackground(log.id);

    return { syncLogId: log.id };
  }

  static async getStatus(): Promise<StockSyncStatus> {
    const [lastSync, totalStocks, gainers, losers, running] = await Promise.all([
      prisma.stockSyncLog.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.stock.count(),
      prisma.stock.count({ where: { changePercent: { gt: 0 } } }),
      prisma.stock.count({ where: { changePercent: { lt: 0 } } }),
      this.isRunning(),
    ]);
    return { lastSync, totalStocks, gainers, losers, isRunning: running };
  }

  static async isRunning(): Promise<boolean> {
    const staleThreshold = new Date(Date.now() - this.STALE_RUNNING_MS);
    const running = await prisma.stockSyncLog.findFirst({
      where: { status: "running", startedAt: { gte: staleThreshold } },
    });
    return running !== null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private static async runBackground(logId: string): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.spawnPython();
      const durationMs = Date.now() - startedAt;

      await prisma.stockSyncLog.update({
        where: { id: logId },
        data: { status: "success", completedAt: new Date(), stocksUpdated: result.stocksUpdated },
      });

      // Bust the Next.js ISR cache so the /stocks page shows fresh data immediately
      try {
        const { revalidateTag } = await import("next/cache");
        revalidateTag("stocks");
      } catch {
        // Outside Next.js context (e.g. standalone Node) — safe to ignore
      }

      console.log(`[StockSync] Done — updated=${result.stocksUpdated} duration=${durationMs}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.stockSyncLog
        .update({ where: { id: logId }, data: { status: "failed", completedAt: new Date(), errorMessage: msg } })
        .catch(console.error);
      console.error("[StockSync] Background sync failed:", msg);
    }
  }

  private static getPythonBin(): string {
    const venvPython = path.join(process.cwd(), "scripts", ".venv", "bin", "python3");
    return existsSync(venvPython) ? venvPython : "python3";
  }

  private static spawnPython(): Promise<{ stocksUpdated: number }> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), "scripts", "stock_sync.py");
      const pythonBin = this.getPythonBin();

      const proc = spawn(pythonBin, [scriptPath], {
        env: { ...process.env },
        cwd: process.cwd(),
        // Detach so the process survives even if the parent HTTP response is closed
        detached: false,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        process.stdout.write(chunk); // stream Python log lines to Node console
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to start Python: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}. stderr: ${stderr.slice(-500)}`));
          return;
        }
        const lines = stdout.trim().split("\n").filter(Boolean);
        const lastLine = lines[lines.length - 1] ?? "{}";
        try {
          const result = JSON.parse(lastLine);
          resolve({ stocksUpdated: result.stocksUpdated ?? 0 });
        } catch {
          resolve({ stocksUpdated: 0 });
        }
      });
    });
  }
}
