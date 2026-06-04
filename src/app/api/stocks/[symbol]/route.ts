import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();

  try {
    const stock = await prisma.stock.findUnique({
      where: { symbol },
      include: { indicators: true },
    });

    if (!stock) {
      return NextResponse.json({ error: `Stock ${symbol} not found` }, { status: 404 });
    }

    return NextResponse.json({
      id:            stock.id,
      symbol:        stock.symbol,
      companyName:   stock.companyName,
      sector:        stock.sector,
      currentPrice:  stock.currentPrice,
      marketCap:     stock.marketCap,
      peRatio:       stock.peRatio,
      pbRatio:       stock.pbRatio,
      dividendYield: stock.dividendYield,
      dayHigh:       stock.dayHigh,
      dayLow:        stock.dayLow,
      week52High:    stock.week52High,
      week52Low:     stock.week52Low,
      volume:        stock.volume !== null ? Number(stock.volume) : null,
      changePercent: stock.changePercent,
      sparklineData: stock.sparklineData,
      updatedAt:     stock.updatedAt.toISOString(),
      indicators: stock.indicators
        ? {
            symbol:     stock.indicators.symbol,
            sma20:      stock.indicators.sma20,
            sma50:      stock.indicators.sma50,
            sma200:     stock.indicators.sma200,
            rsi:        stock.indicators.rsi,
            macd:       stock.indicators.macd,
            macdSignal: stock.indicators.macdSignal,
            macdHist:   stock.indicators.macdHist,
            updatedAt:  stock.indicators.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error(`[GET /api/stocks/${symbol}]`, err);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}
