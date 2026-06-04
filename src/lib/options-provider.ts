/**
 * Options Data Provider Interface
 *
 * Defines the contract for any options data source. Current implementation
 * returns placeholder data. Future providers can implement this interface:
 *
 *   - NSE Option Chain (official NSE API)
 *   - Upstox API
 *   - Angel One SmartAPI
 *   - Dhan API
 *
 * To wire in a real provider, implement OptionsDataProvider and pass it
 * to getOptionsProvider() — the rest of the codebase consumes the interface.
 */

export interface OptionStrike {
  strike: number;
  expiry: Date;
  callOI: number | null;
  putOI: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callLTP: number | null;
  putLTP: number | null;
}

export interface OptionGreeks {
  callDelta: number | null;
  putDelta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
}

export interface OptionChainResult {
  symbol: string;
  expiries: Date[];
  chain: Array<OptionStrike & { greeks: OptionGreeks | null }>;
  fetchedAt: Date;
}

export interface OptionsDataProvider {
  /** Fetch the full option chain for a symbol. */
  getOptionChain(symbol: string): Promise<OptionChainResult>;

  /** Fetch Greeks for a specific strike/expiry. */
  getGreeks(
    symbol: string,
    strike: number,
    expiry: Date,
    optionType: "call" | "put"
  ): Promise<OptionGreeks | null>;

  /** Whether this provider is configured and available. */
  isAvailable(): boolean;
}

// ── Placeholder Provider ───────────────────────────────────────────────────

class PlaceholderOptionsProvider implements OptionsDataProvider {
  isAvailable(): boolean {
    return false;
  }

  async getOptionChain(symbol: string): Promise<OptionChainResult> {
    return {
      symbol,
      expiries: [],
      chain: [],
      fetchedAt: new Date(),
    };
  }

  async getGreeks(
    _symbol: string,
    _strike: number,
    _expiry: Date,
    _optionType: "call" | "put"
  ): Promise<OptionGreeks | null> {
    return null;
  }
}

// ── Provider Registry ─────────────────────────────────────────────────────

type ProviderName = "nse" | "upstox" | "angelone" | "dhan" | "placeholder";

const ACTIVE_PROVIDER: ProviderName =
  (process.env.OPTIONS_PROVIDER as ProviderName) || "placeholder";

const providerCache = new Map<ProviderName, OptionsDataProvider>();

export function getOptionsProvider(
  name: ProviderName = ACTIVE_PROVIDER
): OptionsDataProvider {
  if (!providerCache.has(name)) {
    // When real providers are implemented, instantiate them here based on `name`
    providerCache.set(name, new PlaceholderOptionsProvider());
  }
  return providerCache.get(name)!;
}
