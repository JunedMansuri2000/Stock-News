// Stock data types — shared between API routes, services, and UI components

export interface StockData {
  id: string;
  symbol: string;
  companyName: string;
  sector: string | null;
  currentPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  changePercent: number | null;
  sparklineData: number[];
  updatedAt: string;
}

export interface StockHistoryPoint {
  timestamp: string;
  price: number;
  volume: number | null;
}

export interface TechnicalIndicatorData {
  symbol: string;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  atr: number | null;
  adx: number | null;
  volumeRs: number | null;
  updatedAt: string;
}

export interface StockDetailData extends StockData {
  indicators: TechnicalIndicatorData | null;
  opportunity: OpportunityData | null;
}

export interface StocksApiResponse {
  stocks: StockData[];
  total: number;
  updatedAt: string | null;
}

export interface StockHistoryApiResponse {
  symbol: string;
  history: StockHistoryPoint[];
  period: HistoryPeriod;
}

export type HistoryPeriod = "1d" | "1w" | "1m" | "3m" | "6m" | "1y";

export interface StockSyncStatus {
  lastSync: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    stocksUpdated: number;
    errorMessage: string | null;
  } | null;
  totalStocks: number;
  gainers: number;
  losers: number;
  isRunning: boolean;
}

export interface StockSyncResult {
  success: boolean;
  stocksUpdated?: number;
  durationMs?: number;
  error?: string;
}

export type SortField = "marketCap" | "changePercent" | "currentPrice" | "volume";
export type SortOrder = "asc" | "desc";

// ── Opportunity Types ──────────────────────────────────────────────────────

export type TradeDirection =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish";

export type RiskLevel = "Low" | "Medium" | "High";

export interface OpportunityData {
  symbol: string;
  companyName: string;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  opportunityScore: number | null;
  direction: TradeDirection | null;
  riskLevel: RiskLevel | null;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  holdingPeriod: string | null;
  momentumScore: number | null;
  trendScore: number | null;
  volumeScore: number | null;
  volatilityScore: number | null;
  technicalScore: number | null;
  greeksScore: number | null;
  updatedAt: string;
}

export interface OpportunitiesApiResponse {
  opportunities: OpportunityData[];
  total: number;
  updatedAt: string | null;
}

export type OpportunityFilter = TradeDirection | "All";
export type OpportunitySortField =
  | "opportunityScore"
  | "momentumScore"
  | "trendScore"
  | "volumeScore"
  | "volatilityScore"
  | "technicalScore";

// ── Options / Greeks Types ─────────────────────────────────────────────────

export interface OptionGreeksData {
  callDelta: number | null;
  putDelta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
}

export interface OptionChainEntry {
  strike: number;
  expiry: string;
  callOI: number | null;
  putOI: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callLTP: number | null;
  putLTP: number | null;
  greeks: OptionGreeksData | null;
}

export interface OptionChainResponse {
  symbol: string;
  expiries: string[];
  chain: OptionChainEntry[];
  updatedAt: string | null;
}
