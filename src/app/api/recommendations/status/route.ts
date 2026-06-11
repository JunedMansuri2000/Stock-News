import { NextResponse } from "next/server";
import { AIRecommendationService } from "@/lib/ai-recommendation-service";

export async function GET() {
  try {
    const status = await AIRecommendationService.getStatus();
    return NextResponse.json(status);
  } catch (err) {
    console.error("[GET /api/recommendations/status]", err);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
