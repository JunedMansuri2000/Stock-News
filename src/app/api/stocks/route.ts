import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sortBy") ?? "marketCap";
    const order  = searchParams.get("order") === "asc" ? "asc" : "desc";

    const allowedSort: Record<string, object> = {
      marketCap:     { marketCap: order },
      changePercent: { changePercent: order },
      currentPrice:  { currentPrice: order },
      volume:        { volume: order },
    };
    const orderBy = allowedSort[sortBy] ?? { marketCap: order };

    const stocks = await prisma.stock.findMany({
      orderBy,
      include: { indicators: true },
    });

    const serialized = stocks.map((s) => ({
      id:            s.id,
      symbol:        s.symbol,
      companyName:   s.companyName,
      sector:        s.sector,
      currentPrice:  s.currentPrice,
      marketCap:     s.marketCap,
      peRatio:       s.peRatio,
      pbRatio:       s.pbRatio,
      dividendYield: s.dividendYield,
      dayHigh:       s.dayHigh,
      dayLow:        s.dayLow,
      week52High:    s.week52High,
      week52Low:     s.week52Low,
      volume:        s.volume !== null ? Number(s.volume) : null,
      changePercent: s.changePercent,
      sparklineData: s.sparklineData,
      updatedAt:     s.updatedAt.toISOString(),
    }));

    const latestUpdate = stocks.length > 0
      ? stocks.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt.toISOString()
      : null;

    return NextResponse.json({ stocks: serialized, total: serialized.length, updatedAt: latestUpdate });
  } catch (err) {
    console.error("[GET /api/stocks]", err);
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }
}
