import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TradeDirection } from "@/types/stocks";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = decodeURIComponent(params.symbol).toUpperCase();

    const [opportunity, indicators, stock] = await Promise.all([
      prisma.stockOpportunity.findUnique({ where: { symbol } }),
      prisma.technicalIndicator.findUnique({ where: { symbol } }),
      prisma.stock.findUnique({
        where: { symbol },
        select: { currentPrice: true, companyName: true, sector: true },
      }),
    ]);

    if (!stock) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    return NextResponse.json({
      symbol,
      companyName: stock.companyName,
      currentPrice: stock.currentPrice,
      opportunity: opportunity
        ? {
            opportunityScore: opportunity.opportunityScore,
            direction:        opportunity.direction as TradeDirection | null,
            riskLevel:        opportunity.riskLevel,
            entryZoneLow:     opportunity.entryZoneLow,
            entryZoneHigh:    opportunity.entryZoneHigh,
            stopLoss:         opportunity.stopLoss,
            target1:          opportunity.target1,
            target2:          opportunity.target2,
            holdingPeriod:    opportunity.holdingPeriod,
            momentumScore:    opportunity.momentumScore,
            trendScore:       opportunity.trendScore,
            volumeScore:      opportunity.volumeScore,
            volatilityScore:  opportunity.volatilityScore,
            technicalScore:   opportunity.technicalScore,
            greeksScore:      opportunity.greeksScore,
            updatedAt:        opportunity.updatedAt.toISOString(),
          }
        : null,
      indicators: indicators
        ? {
            sma20:          indicators.sma20,
            sma50:          indicators.sma50,
            sma200:         indicators.sma200,
            ema20:          indicators.ema20,
            rsi:            indicators.rsi,
            macd:           indicators.macd,
            macdSignal:     indicators.macdSignal,
            macdHist:       indicators.macdHist,
            bollingerUpper: indicators.bollingerUpper,
            bollingerMiddle:indicators.bollingerMiddle,
            bollingerLower: indicators.bollingerLower,
            atr:            indicators.atr,
            adx:            indicators.adx,
            volumeRs:       indicators.volumeRs,
            updatedAt:      indicators.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error("[/api/stocks/[symbol]/trade-setup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
