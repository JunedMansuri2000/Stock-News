export type RecommendationCategory =
  | "Strong Buy"
  | "Buy"
  | "Accumulate"
  | "Hold"
  | "Reduce"
  | "Sell"
  | "Strong Sell";

export interface AIRecommendationData {
  id: string;
  symbol: string;
  companyName: string;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  recommendation: RecommendationCategory;
  confidenceScore: number;
  overallScore: number;
  technicalScore: number;
  sentimentScore: number;
  momentumScore: number;
  bullCase: string;
  bearCase: string;
  risks: string[];
  catalysts: string[];
  summary: string;
  holdingPeriod: string;
  positiveNewsCount: number;
  negativeNewsCount: number;
  neutralNewsCount: number;
  newsMomentumScore: number;
  newsConfidenceScore: number;
  aiGenerated: boolean;
  createdAt: string;
}

export interface RecommendationsApiResponse {
  recommendations: AIRecommendationData[];
  total: number;
  generatedAt: string | null;
  isStale: boolean;
}

export interface RecommendationFilter {
  recommendation: RecommendationCategory | "All";
  minConfidence: number;
  sector: string | "All";
  holdingPeriod: string | "All";
}

export type RecommendationSortField =
  | "overallScore"
  | "confidenceScore"
  | "technicalScore"
  | "sentimentScore"
  | "momentumScore"
  | "changePercent";

export interface RecommendationStatus {
  lastLog: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    stocksAnalyzed: number;
    recommendationsCreated: number;
    aiStocksProcessed: number;
    aiProvider: string | null;
    modelName: string | null;
    generationMs: number | null;
    batchCount: number | null;
    errorMessage: string | null;
  } | null;
  totalRecommendations: number;
  isRunning: boolean;
  isStale: boolean;
  lastGeneratedAt: string | null;
}

export interface AIAnalysisResult {
  recommendation: RecommendationCategory;
  confidenceScore: number;
  bullCase: string;
  bearCase: string;
  risks: string[];
  catalysts: string[];
  summary: string;
  holdingPeriod: string;
}

export interface StockAnalysisInput {
  symbol: string;
  companyName: string;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  adx: number | null;
  atr: number | null;
  opportunityScore: number | null;
  direction: string | null;
  momentumScore: number | null;
  trendScore: number | null;
  volumeScore: number | null;
  volatilityScore: number | null;
  technicalScore: number | null;
  recentNews: Array<{
    title: string;
    source: string | null;
    publishedAt: string;
    sentiment: "positive" | "negative" | "neutral";
  }>;
  positiveNewsCount: number;
  negativeNewsCount: number;
  neutralNewsCount: number;
  newsMomentumScore: number;
  newsConfidenceScore: number;
  preScore: {
    technicalScore: number;
    sentimentScore: number;
    momentumScore: number;
    overall: number;
  };
}
