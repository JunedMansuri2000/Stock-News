import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpportunityData, OpportunitiesApiResponse, TradeDirection } from "@/types/stocks";

export const dynamic = "force-dynamic";

const VALID_DIRECTIONS = new Set([
  "Strong Bullish", "Bullish", "Neutral", "Bearish", "Strong Bearish",
]);

const VALID_SORT = new Set([
  "opportunityScore", "momentumScore", "trendScore",
  "volumeScore", "volatilityScore", "technicalScore",
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const direction = searchParams.get("direction") || "All";
    const sort = searchParams.get("sort") || "opportunityScore";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 100);

    const safeSort = VALID_SORT.has(sort) ? sort : "opportunityScore";
    const directionFilter =
      direction !== "All" && VALID_DIRECTIONS.has(direction)
        ? direction
        : undefined;

    const where = directionFilter ? { direction: directionFilter } : {};

    const rows = await prisma.stockOpportunity.findMany({
      where,
      orderBy: { [safeSort]: "desc" },
      take: limit,
      include: {
        stock: {
          select: {
            companyName: true,
            sector: true,
            currentPrice: true,
            changePercent: true,
          },
        },
      },
    });

    const lastRecord = await prisma.stockOpportunity.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const opportunities: OpportunityData[] = rows.map((r) => ({
      symbol:          r.symbol,
      companyName:     r.stock.companyName,
      sector:          r.stock.sector,
      currentPrice:    r.stock.currentPrice,
      changePercent:   r.stock.changePercent,
      opportunityScore: r.opportunityScore,
      direction:       r.direction as TradeDirection | null,
      riskLevel:       r.riskLevel as OpportunityData["riskLevel"],
      entryZoneLow:    r.entryZoneLow,
      entryZoneHigh:   r.entryZoneHigh,
      stopLoss:        r.stopLoss,
      target1:         r.target1,
      target2:         r.target2,
      holdingPeriod:   r.holdingPeriod,
      momentumScore:   r.momentumScore,
      trendScore:      r.trendScore,
      volumeScore:     r.volumeScore,
      volatilityScore: r.volatilityScore,
      technicalScore:  r.technicalScore,
      greeksScore:     r.greeksScore,
      updatedAt:       r.updatedAt.toISOString(),
    }));

    const response: OpportunitiesApiResponse = {
      opportunities,
      total: opportunities.length,
      updatedAt: lastRecord?.updatedAt.toISOString() ?? null,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/opportunities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
