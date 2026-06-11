import type { AIAnalysisResult, RecommendationCategory, StockAnalysisInput } from "@/types/recommendations";

// ── Provider Interface ─────────────────────────────────────────────────────

export interface AIProvider {
  /** Generate a recommendation for a single stock (used when batch fails). */
  generateRecommendation(input: StockAnalysisInput): Promise<AIAnalysisResult>;
  /** Generate recommendations for multiple stocks in one request. */
  generateBatch(inputs: StockAnalysisInput[]): Promise<AIAnalysisResult[]>;
  /** Sync check — is this provider configured? */
  isAvailable(): boolean;
  /** Returns human-readable provider name and active model. */
  getProviderInfo(): { name: string; model: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size)
  );
}

/** Strip <think>...</think> blocks that some models (qwen3) emit. */
function stripThinking(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Extract the first valid JSON object or array from a string.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function extractJson(raw: string): string {
  const clean = stripThinking(raw);
  // Strip markdown code fences
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // Find first { or [
  const start = clean.search(/[{[]/);
  if (start === -1) return "{}";
  // Find matching end
  let depth = 0;
  let inStr = false;
  let escape = false;
  let end = start;
  for (let i = start; i < clean.length; i++) {
    const c = clean[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inStr) { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  return clean.slice(start, end + 1);
}

const VALID_RECOMMENDATIONS: RecommendationCategory[] = [
  "Strong Buy", "Buy", "Accumulate", "Hold", "Reduce", "Sell", "Strong Sell",
];

function normalizeRecommendation(raw: string | undefined): RecommendationCategory {
  if (!raw) return "Hold";
  const cleaned = raw.trim();
  if (VALID_RECOMMENDATIONS.includes(cleaned as RecommendationCategory)) {
    return cleaned as RecommendationCategory;
  }
  // Fuzzy match
  const lower = cleaned.toLowerCase();
  if (lower.includes("strong buy")) return "Strong Buy";
  if (lower.includes("strong sell")) return "Strong Sell";
  if (lower.includes("accumulate")) return "Accumulate";
  if (lower.includes("reduce")) return "Reduce";
  if (lower.includes("buy")) return "Buy";
  if (lower.includes("sell")) return "Sell";
  return "Hold";
}

function parseAnalysisResult(parsed: Record<string, unknown>): AIAnalysisResult {
  return {
    recommendation: normalizeRecommendation(parsed.recommendation as string),
    confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore ?? parsed.confidence ?? 50))),
    bullCase: String(parsed.bullCase ?? ""),
    bearCase: String(parsed.bearCase ?? ""),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.map(String) : [],
    summary: String(parsed.summary ?? ""),
    holdingPeriod: String(parsed.holdingPeriod ?? "3-10 trading days"),
  };
}

// ── Prompt Builders ────────────────────────────────────────────────────────

function buildSingleStockBlock(input: StockAnalysisInput, index: number): string {
  const newsLines = input.recentNews
    .slice(0, 5)
    .map((n) => `    [${n.sentiment.toUpperCase()}] ${n.title}`)
    .join("\n");

  return `=== STOCK ${index + 1}: ${input.symbol} ===
Company: ${input.companyName} | Sector: ${input.sector ?? "Unknown"}
Price: ₹${input.currentPrice ?? "N/A"} (${(input.changePercent ?? 0) >= 0 ? "+" : ""}${input.changePercent?.toFixed(2) ?? "0"}%) | MarketCap: ${input.marketCap ? "₹" + (input.marketCap / 1e9).toFixed(0) + "B" : "N/A"}
RSI: ${input.rsi?.toFixed(1) ?? "N/A"} | MACD: ${(input.macd ?? 0) > (input.macdSignal ?? 0) ? "Bullish" : "Bearish"} | Trend: ${input.direction ?? "N/A"}
SMA20: ${input.sma20?.toFixed(0) ?? "N/A"} | SMA50: ${input.sma50?.toFixed(0) ?? "N/A"} | SMA200: ${input.sma200?.toFixed(0) ?? "N/A"} | ADX: ${input.adx?.toFixed(1) ?? "N/A"}
Opportunity Score: ${input.opportunityScore?.toFixed(0) ?? "N/A"}/100
News (30d): ${input.positiveNewsCount}pos/${input.negativeNewsCount}neg/${input.neutralNewsCount}neu
Pre-Scores: Tech=${input.preScore.technicalScore.toFixed(1)}/40, Sentiment=${input.preScore.sentimentScore.toFixed(1)}/40, Momentum=${input.preScore.momentumScore.toFixed(1)}/20, OVERALL=${input.preScore.overall.toFixed(1)}/100
${newsLines ? `Top headlines:\n${newsLines}` : "No recent news."}`;
}

function buildBatchPrompt(inputs: StockAnalysisInput[]): string {
  const stockBlocks = inputs.map((s, i) => buildSingleStockBlock(s, i)).join("\n\n");
  const symbolList = inputs.map((s) => s.symbol).join(", ");

  return `Analyze these ${inputs.length} Indian NSE stocks: ${symbolList}

Return a JSON object with a "recommendations" array — one entry per stock in the SAME ORDER as listed.
Each entry MUST have:
- symbol: exact symbol string
- recommendation: exactly one of [Strong Buy, Buy, Accumulate, Hold, Reduce, Sell, Strong Sell]
- confidenceScore: integer 0-100
- bullCase: 2-3 sentence bull thesis
- bearCase: 1-2 sentence bear thesis
- risks: array of 2-3 short risk strings
- catalysts: array of 2-3 short catalyst strings
- summary: 1-sentence plain English summary
- holdingPeriod: e.g. "3-10 trading days" or "1-3 weeks"

Scoring guidelines:
- score >85 = Strong Buy, >70 = Buy, >55 = Accumulate, >45 = Hold, >35 = Reduce, >25 = Sell, <=25 = Strong Sell
- Boost recommendation if RSI 50-70 + bullish MACD + positive news
- Penalize if RSI >75 (overbought) or negative news dominates
- Base decisions ONLY on provided data. Do not hallucinate company facts.

${stockBlocks}

IMPORTANT: Return ONLY the JSON object. No explanations, no markdown, no code fences.`;
}

// ── OllamaProvider ─────────────────────────────────────────────────────────

export class OllamaProvider implements AIProvider {
  private readonly host: string;
  private readonly model: string;
  private readonly timeoutMs = 180_000; // 3 min per batch

  constructor() {
    this.host = (process.env.OLLAMA_HOST ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = process.env.OLLAMA_MODEL ?? "qwen3:8b";
  }

  isAvailable(): boolean {
    return true; // always configured — connectivity tested at call time
  }

  getProviderInfo() {
    return { name: "ollama", model: this.model };
  }

  async generateRecommendation(input: StockAnalysisInput): Promise<AIAnalysisResult> {
    const results = await this.generateBatch([input]);
    return results[0];
  }

  async generateBatch(inputs: StockAnalysisInput[]): Promise<AIAnalysisResult[]> {
    const prompt = buildBatchPrompt(inputs);

    let rawText: string;
    try {
      rawText = await this.callOllama(prompt);
    } catch (err) {
      console.error("[OllamaProvider] API call failed:", err instanceof Error ? err.message : err);
      // Fall back to rule-based for the entire batch
      const rule = new RuleBasedProvider();
      return Promise.all(inputs.map((s) => rule.generateRecommendation(s)));
    }

    return this.parseBatchResponse(rawText, inputs);
  }

  private async callOllama(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a senior equity analyst specializing in Indian stock markets (NSE/BSE). " +
                "Return only valid JSON. Do not include any explanations or markdown.",
            },
            { role: "user", content: prompt },
          ],
          format: "json",
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 8192,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = (await res.json()) as { message?: { content?: string }; response?: string };
      return data.message?.content ?? data.response ?? "";
    } finally {
      clearTimeout(timer);
    }
  }

  private parseBatchResponse(raw: string, inputs: StockAnalysisInput[]): AIAnalysisResult[] {
    const rule = new RuleBasedProvider();

    let parsed: { recommendations?: unknown[] } = {};
    try {
      const json = extractJson(raw);
      parsed = JSON.parse(json);
    } catch {
      console.error("[OllamaProvider] JSON parse failed, falling back to rule-based");
      return inputs.map((s) => {
        const r = rule.generateRecommendationSync(s);
        return r;
      });
    }

    const items: unknown[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : Array.isArray(parsed)
      ? (parsed as unknown[])
      : [];

    return inputs.map((input, i) => {
      const entry = (items[i] ?? {}) as Record<string, unknown>;
      // Verify the symbol matches to guard against order mismatches
      const symbolMatch =
        !entry.symbol ||
        String(entry.symbol).toUpperCase() === input.symbol.toUpperCase() ||
        String(entry.symbol).toUpperCase() === input.symbol.replace(".NS", "").toUpperCase();

      if (!symbolMatch || !entry.recommendation) {
        console.warn(`[OllamaProvider] Missing/mismatched entry for ${input.symbol}, using rule-based`);
        return rule.generateRecommendationSync(input);
      }

      try {
        return parseAnalysisResult(entry);
      } catch {
        return rule.generateRecommendationSync(input);
      }
    });
  }
}

// ── OpenAIProvider (optional fallback) ────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? "";
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  getProviderInfo() {
    return { name: "openai", model: this.model };
  }

  async generateBatch(inputs: StockAnalysisInput[]): Promise<AIAnalysisResult[]> {
    return Promise.all(inputs.map((s) => this.generateRecommendation(s)));
  }

  async generateRecommendation(input: StockAnalysisInput): Promise<AIAnalysisResult> {
    if (!this.isAvailable()) throw new Error("OPENAI_API_KEY is not set");

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior equity analyst for Indian stock markets. Return valid JSON only.",
        },
        {
          role: "user",
          content: buildBatchPrompt([input]),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 600,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const outer = JSON.parse(raw) as { recommendations?: unknown[] };
    const entry = (
      Array.isArray(outer.recommendations) ? outer.recommendations[0] : outer
    ) as Record<string, unknown>;
    return parseAnalysisResult(entry);
  }
}

// ── Rule-Based Provider ────────────────────────────────────────────────────

export class RuleBasedProvider implements AIProvider {
  isAvailable(): boolean {
    return true;
  }

  getProviderInfo() {
    return { name: "rule-based", model: "deterministic" };
  }

  async generateBatch(inputs: StockAnalysisInput[]): Promise<AIAnalysisResult[]> {
    return inputs.map((s) => this.generateRecommendationSync(s));
  }

  async generateRecommendation(input: StockAnalysisInput): Promise<AIAnalysisResult> {
    return this.generateRecommendationSync(input);
  }

  generateRecommendationSync(input: StockAnalysisInput): AIAnalysisResult {
    const score = input.preScore.overall;
    const direction = input.direction ?? "Neutral";

    const recommendation = this.scoreToRecommendation(score, direction);
    const confidenceScore = this.calcConfidence(score, input);

    return {
      recommendation,
      confidenceScore,
      bullCase: this.buildBullCase(input),
      bearCase: this.buildBearCase(input),
      risks: this.buildRisks(input),
      catalysts: this.buildCatalysts(input),
      summary: `${input.companyName} shows a ${recommendation.toLowerCase()} signal with a composite score of ${score.toFixed(0)}/100.`,
      holdingPeriod: this.calcHoldingPeriod(input),
    };
  }

  private scoreToRecommendation(score: number, direction: string): RecommendationCategory {
    if (score >= 85) return "Strong Buy";
    if (score >= 70 && direction !== "Strong Bearish") return "Buy";
    if (score >= 55) return "Accumulate";
    if (score >= 45) return "Hold";
    if (score >= 35) return "Reduce";
    if (score >= 25) return "Sell";
    return "Strong Sell";
  }

  private calcConfidence(score: number, input: StockAnalysisInput): number {
    const newsConf = input.newsConfidenceScore * 20;
    const techConf = input.opportunityScore ? Math.min(20, input.opportunityScore * 0.2) : 10;
    const base = Math.min(60, Math.abs(score - 50) * 1.2);
    return Math.round(Math.min(90, base + newsConf + techConf));
  }

  private calcHoldingPeriod(input: StockAnalysisInput): string {
    const vol = input.volatilityScore ?? 10;
    if (vol >= 15) return "2-3 trading days";
    if (vol >= 10) return "3-7 trading days";
    return "1-3 weeks";
  }

  private buildBullCase(input: StockAnalysisInput): string {
    const parts: string[] = [];
    if ((input.rsi ?? 50) >= 55 && (input.rsi ?? 50) <= 70) parts.push("RSI in healthy bullish range");
    if ((input.macd ?? 0) > (input.macdSignal ?? 0)) parts.push("MACD bullish crossover");
    if (input.direction === "Strong Bullish" || input.direction === "Bullish")
      parts.push("strong uptrend alignment across moving averages");
    if ((input.volumeScore ?? 0) >= 15) parts.push("exceptional volume expansion confirming breakout");
    if (input.positiveNewsCount > input.negativeNewsCount)
      parts.push(`positive news flow (${input.positiveNewsCount}+ vs ${input.negativeNewsCount}-)`);
    if (parts.length === 0) parts.push("no immediate bearish catalysts present");
    return parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";
  }

  private buildBearCase(input: StockAnalysisInput): string {
    const parts: string[] = [];
    if ((input.rsi ?? 50) > 75) parts.push("RSI approaching overbought territory");
    if (input.negativeNewsCount > input.positiveNewsCount) parts.push("negative news sentiment dominates");
    if (input.direction === "Bearish" || input.direction === "Strong Bearish")
      parts.push("downtrend visible across moving averages");
    if (parts.length === 0) parts.push("limited upside without a fresh catalyst");
    return parts.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
  }

  private buildRisks(input: StockAnalysisInput): string[] {
    const risks: string[] = [];
    if ((input.rsi ?? 50) > 70) risks.push("Overbought RSI — potential pullback");
    if ((input.adx ?? 0) < 20) risks.push("Weak trend strength (ADX < 20)");
    if (input.negativeNewsCount >= 3) risks.push("Multiple negative news events in last 30 days");
    risks.push("Broader market or sector correction could override local setup");
    return risks.slice(0, 3);
  }

  private buildCatalysts(input: StockAnalysisInput): string[] {
    const catalysts: string[] = [];
    if ((input.volumeScore ?? 0) >= 12) catalysts.push("Volume breakout — institutional interest likely");
    if (input.positiveNewsCount >= 3) catalysts.push("Positive news momentum building");
    if ((input.macd ?? 0) > (input.macdSignal ?? 0)) catalysts.push("MACD bullish crossover in play");
    catalysts.push("Nifty 100 index strength supports large-cap upside");
    return catalysts.slice(0, 3);
  }
}

// ── Registry ───────────────────────────────────────────────────────────────

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "ollama").toLowerCase();
  switch (provider) {
    case "openai":
      return new OpenAIProvider();
    case "rule-based":
    case "none":
      return new RuleBasedProvider();
    case "ollama":
    default:
      return new OllamaProvider();
  }
}

export function getRuleBasedProvider(): RuleBasedProvider {
  return new RuleBasedProvider();
}
