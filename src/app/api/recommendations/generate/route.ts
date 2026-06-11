import { NextResponse } from "next/server";
import { AIRecommendationService, RecommendationAlreadyRunningError } from "@/lib/ai-recommendation-service";

export async function POST() {
  try {
    const { logId } = await AIRecommendationService.generate();
    return NextResponse.json({ success: true, logId, message: "Recommendation generation started in background." });
  } catch (err) {
    if (err instanceof RecommendationAlreadyRunningError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 409 });
    }
    console.error("[POST /api/recommendations/generate]", err);
    return NextResponse.json({ success: false, error: "Failed to start generation" }, { status: 500 });
  }
}
