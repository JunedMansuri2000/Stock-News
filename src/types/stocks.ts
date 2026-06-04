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
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  updatedAt: string;
}

export interface StockDetailData extends StockData {
  indicators: TechnicalIndicatorData | null;
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
