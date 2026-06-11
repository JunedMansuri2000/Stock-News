import { NextRequest, NextResponse } from "next/server";
import { AIRecommendationService } from "@/lib/ai-recommendation-service";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const recommendation = searchParams.get("recommendation") ?? undefined;
  const minConfidence = searchParams.has("minConfidence")
    ? Number(searchParams.get("minConfidence"))
    : undefined;
  const sector = searchParams.get("sector") ?? undefined;
  const holdingPeriod = searchParams.get("holdingPeriod") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = searchParams.has("limit") ? Math.min(200, Number(searchParams.get("limit"))) : 100;

  try {
    const [recommendations, status] = await Promise.all([
      AIRecommendationService.getRecommendations({ recommendation, minConfidence, sector, holdingPeriod, sort, limit }),
      AIRecommendationService.getStatus(),
    ]);

    return NextResponse.json({
      recommendations,
      total: recommendations.length,
      generatedAt: status.lastGeneratedAt,
      isStale: status.isStale,
    });
  } catch (err) {
    console.error("[GET /api/recommendations]", err);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
