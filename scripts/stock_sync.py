#!/usr/bin/env python3
"""
Stock Sync Script — fetches Nifty 100 data from Yahoo Finance,
calculates technical indicators + opportunity scores, upserts into PostgreSQL.

Environment variables required (reads .env automatically):
  DATABASE_URL — PostgreSQL connection string
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import psycopg2.extras
import pandas as pd
import yfinance as yf
import pandas_ta as ta
from dotenv import load_dotenv

# ── Config ──────────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[StockSync] %(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("StockSync")

NIFTY100_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "BHARTIARTL.NS", "ICICIBANK.NS",
    "INFY.NS", "SBIN.NS", "HINDUNILVR.NS", "ITC.NS", "LICI.NS",
    "KOTAKBANK.NS", "LT.NS", "HCLTECH.NS", "BAJFINANCE.NS", "MARUTI.NS",
    "AXISBANK.NS", "SUNPHARMA.NS", "ADANIENT.NS", "TITAN.NS", "WIPRO.NS",
    "NTPC.NS", "ULTRACEMCO.NS", "BAJAJFINSV.NS", "POWERGRID.NS", "M&M.NS",
    "ASIANPAINT.NS", "NESTLEIND.NS", "TATAMOTORS.NS", "COALINDIA.NS", "HDFCLIFE.NS",
    "INDUSINDBK.NS", "TECHM.NS", "TATASTEEL.NS", "ONGC.NS", "JSWSTEEL.NS",
    "ADANIPORTS.NS", "HINDALCO.NS", "GRASIM.NS", "CIPLA.NS", "SBILIFE.NS",
    "DRREDDY.NS", "DIVISLAB.NS", "TATACONSUM.NS", "BAJAJ-AUTO.NS", "BRITANNIA.NS",
    "HEROMOTOCO.NS", "EICHERMOT.NS", "APOLLOHOSP.NS", "BPCL.NS", "BEL.NS",
    "SHRIRAMFIN.NS", "SIEMENS.NS", "TRENT.NS", "HAVELLS.NS", "ICICIGI.NS",
    "ICICIPRULI.NS", "MUTHOOTFIN.NS", "BOSCHLTD.NS", "VEDL.NS", "GAIL.NS",
    "AMBUJACEM.NS", "BANKBARODA.NS", "CHOLAFIN.NS", "DABUR.NS", "DMART.NS",
    "GODREJCP.NS", "HDFCAMC.NS", "INDIGO.NS", "INDUSTOWER.NS", "IRCTC.NS",
    "JIOFIN.NS", "LTIM.NS", "LUPIN.NS", "MARICO.NS", "MANKIND.NS",
    "NAUKRI.NS", "OBEROIRLTY.NS", "PFC.NS", "PIDILITIND.NS", "RECLTD.NS",
    "SBICARD.NS", "SHREECEM.NS", "TATAPOWER.NS", "TORNTPHARM.NS", "TVSMOTOR.NS",
    "VBL.NS", "ZOMATO.NS", "ZYDUSLIFE.NS", "ABB.NS", "ACC.NS",
    "ADANIGREEN.NS", "ADANIPOWER.NS", "NHPC.NS", "NYKAA.NS", "CANBK.NS",
    "CGPOWER.NS", "JSWENERGY.NS", "LODHA.NS", "MAXHEALTH.NS", "MOTHERSON.NS",
]

BATCH_SIZE = 10
HISTORY_PERIOD = "1y"
SPARKLINE_DAYS = 30


# ── Database ─────────────────────────────────────────────────────────────────

def get_conn():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(url)


def ensure_tables(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'Stock'
        """)
        if cur.fetchone() is None:
            log.warning("Stock table not found — run: npx prisma db push")
    conn.commit()


def upsert_stock(conn, row: dict):
    sql = """
        INSERT INTO "Stock" (
            id, symbol, "companyName", sector, "currentPrice", "marketCap",
            "peRatio", "pbRatio", "dividendYield", "dayHigh", "dayLow",
            "week52High", "week52Low", volume, "changePercent", "sparklineData",
            "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, %(symbol)s, %(companyName)s, %(sector)s,
            %(currentPrice)s, %(marketCap)s, %(peRatio)s, %(pbRatio)s,
            %(dividendYield)s, %(dayHigh)s, %(dayLow)s, %(week52High)s,
            %(week52Low)s, %(volume)s, %(changePercent)s, %(sparklineData)s,
            NOW(), NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            "companyName"   = EXCLUDED."companyName",
            sector          = EXCLUDED.sector,
            "currentPrice"  = EXCLUDED."currentPrice",
            "marketCap"     = EXCLUDED."marketCap",
            "peRatio"       = EXCLUDED."peRatio",
            "pbRatio"       = EXCLUDED."pbRatio",
            "dividendYield" = EXCLUDED."dividendYield",
            "dayHigh"       = EXCLUDED."dayHigh",
            "dayLow"        = EXCLUDED."dayLow",
            "week52High"    = EXCLUDED."week52High",
            "week52Low"     = EXCLUDED."week52Low",
            volume          = EXCLUDED.volume,
            "changePercent" = EXCLUDED."changePercent",
            "sparklineData" = EXCLUDED."sparklineData",
            "updatedAt"     = NOW()
    """
    with conn.cursor() as cur:
        cur.execute(sql, row)


def upsert_history(conn, symbol: str, history_df: pd.DataFrame):
    if history_df.empty:
        return
    rows = []
    for ts, row in history_df.iterrows():
        price = float(row["Close"]) if pd.notna(row["Close"]) else None
        volume = int(row["Volume"]) if pd.notna(row["Volume"]) else None
        if price is None:
            continue
        rows.append((symbol, price, volume, ts.to_pydatetime()))

    sql = """
        INSERT INTO "StockHistory" (id, symbol, price, volume, timestamp)
        VALUES (gen_random_uuid()::text, %s, %s, %s, %s)
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
            price  = EXCLUDED.price,
            volume = EXCLUDED.volume
    """
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=200)


def upsert_indicators(conn, symbol: str, ind: dict):
    sql = """
        INSERT INTO "TechnicalIndicator" (
            id, symbol,
            sma20, sma50, sma200, ema20,
            rsi, macd, "macdSignal", "macdHist",
            "bollingerUpper", "bollingerMiddle", "bollingerLower",
            atr, adx, "volumeRs",
            "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, %(symbol)s,
            %(sma20)s, %(sma50)s, %(sma200)s, %(ema20)s,
            %(rsi)s, %(macd)s, %(macdSignal)s, %(macdHist)s,
            %(bollingerUpper)s, %(bollingerMiddle)s, %(bollingerLower)s,
            %(atr)s, %(adx)s, %(volumeRs)s,
            NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            sma20            = EXCLUDED.sma20,
            sma50            = EXCLUDED.sma50,
            sma200           = EXCLUDED.sma200,
            ema20            = EXCLUDED.ema20,
            rsi              = EXCLUDED.rsi,
            macd             = EXCLUDED.macd,
            "macdSignal"     = EXCLUDED."macdSignal",
            "macdHist"       = EXCLUDED."macdHist",
            "bollingerUpper" = EXCLUDED."bollingerUpper",
            "bollingerMiddle"= EXCLUDED."bollingerMiddle",
            "bollingerLower" = EXCLUDED."bollingerLower",
            atr              = EXCLUDED.atr,
            adx              = EXCLUDED.adx,
            "volumeRs"       = EXCLUDED."volumeRs",
            "updatedAt"      = NOW()
    """
    ind["symbol"] = symbol
    with conn.cursor() as cur:
        cur.execute(sql, ind)


def upsert_opportunity(conn, symbol: str, opp: dict):
    sql = """
        INSERT INTO "StockOpportunity" (
            id, symbol,
            "opportunityScore", direction, "riskLevel",
            "entryZoneLow", "entryZoneHigh", "stopLoss", target1, target2,
            "holdingPeriod",
            "momentumScore", "trendScore", "volumeScore",
            "volatilityScore", "technicalScore", "greeksScore",
            "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, %(symbol)s,
            %(opportunityScore)s, %(direction)s, %(riskLevel)s,
            %(entryZoneLow)s, %(entryZoneHigh)s, %(stopLoss)s, %(target1)s, %(target2)s,
            %(holdingPeriod)s,
            %(momentumScore)s, %(trendScore)s, %(volumeScore)s,
            %(volatilityScore)s, %(technicalScore)s, %(greeksScore)s,
            NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
            "opportunityScore" = EXCLUDED."opportunityScore",
            direction          = EXCLUDED.direction,
            "riskLevel"        = EXCLUDED."riskLevel",
            "entryZoneLow"     = EXCLUDED."entryZoneLow",
            "entryZoneHigh"    = EXCLUDED."entryZoneHigh",
            "stopLoss"         = EXCLUDED."stopLoss",
            target1            = EXCLUDED.target1,
            target2            = EXCLUDED.target2,
            "holdingPeriod"    = EXCLUDED."holdingPeriod",
            "momentumScore"    = EXCLUDED."momentumScore",
            "trendScore"       = EXCLUDED."trendScore",
            "volumeScore"      = EXCLUDED."volumeScore",
            "volatilityScore"  = EXCLUDED."volatilityScore",
            "technicalScore"   = EXCLUDED."technicalScore",
            "greeksScore"      = EXCLUDED."greeksScore",
            "updatedAt"        = NOW()
    """
    opp["symbol"] = symbol
    with conn.cursor() as cur:
        cur.execute(sql, opp)


def log_sync_start(conn) -> str:
    sql = """
        INSERT INTO "StockSyncLog" (id, "startedAt", status)
        VALUES (gen_random_uuid()::text, NOW(), 'running')
        RETURNING id
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        row = cur.fetchone()
    conn.commit()
    return row[0]


def log_sync_done(conn, log_id: str, updated: int, error: Optional[str] = None):
    status = "failed" if error else "success"
    sql = """
        UPDATE "StockSyncLog"
        SET "completedAt" = NOW(), status = %s, "stocksUpdated" = %s, "errorMessage" = %s
        WHERE id = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (status, updated, error, log_id))
    conn.commit()


# ── Technical Indicators ─────────────────────────────────────────────────────

def last_valid(series) -> Optional[float]:
    v = series.dropna()
    return float(v.iloc[-1]) if not v.empty else None


def calc_indicators(closes: pd.Series, highs: pd.Series, lows: pd.Series, volumes: pd.Series) -> dict:
    result = {
        "sma20": None, "sma50": None, "sma200": None, "ema20": None,
        "rsi": None, "macd": None, "macdSignal": None, "macdHist": None,
        "bollingerUpper": None, "bollingerMiddle": None, "bollingerLower": None,
        "atr": None, "adx": None, "volumeRs": None,
    }
    if len(closes) < 20:
        return result

    try:
        # Moving averages
        result["sma20"]  = last_valid(ta.sma(closes, length=20))
        result["sma50"]  = last_valid(ta.sma(closes, length=50))
        result["sma200"] = last_valid(ta.sma(closes, length=200))
        result["ema20"]  = last_valid(ta.ema(closes, length=20))

        # RSI
        result["rsi"] = last_valid(ta.rsi(closes, length=14))

        # MACD
        macd_df = ta.macd(closes, fast=12, slow=26, signal=9)
        if macd_df is not None and not macd_df.empty:
            result["macd"]       = last_valid(macd_df.iloc[:, 0])
            result["macdSignal"] = last_valid(macd_df.iloc[:, 2])
            result["macdHist"]   = last_valid(macd_df.iloc[:, 1])

        # Bollinger Bands
        bb = ta.bbands(closes, length=20, std=2)
        if bb is not None and not bb.empty:
            cols = bb.columns.tolist()
            bbl = next((c for c in cols if c.startswith("BBL")), None)
            bbm = next((c for c in cols if c.startswith("BBM")), None)
            bbu = next((c for c in cols if c.startswith("BBU")), None)
            if bbl: result["bollingerLower"]  = last_valid(bb[bbl])
            if bbm: result["bollingerMiddle"] = last_valid(bb[bbm])
            if bbu: result["bollingerUpper"]  = last_valid(bb[bbu])

        # ATR
        if highs is not None and lows is not None:
            result["atr"] = last_valid(ta.atr(highs, lows, closes, length=14))

        # ADX
        if highs is not None and lows is not None:
            adx_df = ta.adx(highs, lows, closes, length=14)
            if adx_df is not None and not adx_df.empty:
                adx_col = next((c for c in adx_df.columns if c.startswith("ADX")), None)
                if adx_col:
                    result["adx"] = last_valid(adx_df[adx_col])

        # Volume Relative Strength (current vs 20-day average)
        if volumes is not None and len(volumes) >= 20:
            avg_vol = float(volumes.tail(20).mean())
            current_vol = float(volumes.iloc[-1])
            if avg_vol > 0:
                result["volumeRs"] = round(current_vol / avg_vol, 4)

    except Exception as e:
        log.warning("Indicator calculation failed: %s", e)

    return result


# ── Opportunity Scoring ───────────────────────────────────────────────────────

def calc_opportunity(indicators: dict, current_price: Optional[float]) -> dict:
    """Compute opportunity score (0-100), direction, and trade setup levels."""

    rsi        = indicators.get("rsi")
    macd       = indicators.get("macd")
    macd_sig   = indicators.get("macdSignal")
    sma20      = indicators.get("sma20")
    sma50      = indicators.get("sma50")
    sma200     = indicators.get("sma200")
    adx        = indicators.get("adx")
    volume_rs  = indicators.get("volumeRs")
    atr        = indicators.get("atr")
    bb_upper   = indicators.get("bollingerUpper")
    bb_middle  = indicators.get("bollingerMiddle")
    bb_lower   = indicators.get("bollingerLower")

    # ── 1. Momentum Score (0-20) ──
    momentum = 0
    if rsi is not None:
        if 55 <= rsi <= 75:
            momentum = 20
        elif (50 <= rsi < 55) or (75 < rsi <= 80):
            momentum = 12
        elif (45 <= rsi < 50) or (80 < rsi):
            momentum = 5

    # ── 2. Trend Strength (0-20) ──
    trend = 0
    if current_price and sma20 and current_price > sma20:
        trend += 5
    if sma20 and sma50 and sma20 > sma50:
        trend += 5
    if sma50 and sma200 and sma50 > sma200:
        trend += 5
    if adx and adx > 25:
        trend += 5

    # ── 3. Volume Expansion (0-20) ──
    vol_score = 0
    if volume_rs is not None:
        if volume_rs >= 2.0:
            vol_score = 20
        elif volume_rs >= 1.5:
            vol_score = 15
        elif volume_rs >= 1.2:
            vol_score = 10
        elif volume_rs >= 1.0:
            vol_score = 5

    # ── 4. Volatility Expansion (0-20) ──
    vol_exp = 0
    if atr and current_price and current_price > 0:
        atr_pct = (atr / current_price) * 100
        if atr_pct >= 3.0:
            vol_exp = 20
        elif atr_pct >= 2.0:
            vol_exp = 15
        elif atr_pct >= 1.5:
            vol_exp = 10
        elif atr_pct >= 1.0:
            vol_exp = 5

    # ── 5. Technical Confirmation (0-20) ──
    tech = 0
    if macd is not None and macd_sig is not None and macd > macd_sig:
        tech += 10
    if bb_middle and current_price and current_price > bb_middle:
        tech += 5
    if bb_upper and bb_lower and bb_middle and bb_middle > 0:
        bb_width_pct = (bb_upper - bb_lower) / bb_middle * 100
        if bb_width_pct > 5:
            tech += 5

    # ── 6. Greeks Score (0-0 placeholder — populated when options data available) ──
    greeks_score = 0

    total = momentum + trend + vol_score + vol_exp + tech + greeks_score

    # ── Direction ──
    # Count bearish signals
    bearish_signals = sum([
        1 if (current_price and sma20 and current_price < sma20) else 0,
        1 if (sma20 and sma50 and sma20 < sma50) else 0,
        1 if (rsi is not None and rsi < 45) else 0,
        1 if (macd is not None and macd_sig is not None and macd < macd_sig) else 0,
        1 if (volume_rs is not None and volume_rs > 1.5) else 0,
    ])

    if total >= 75:
        direction = "Strong Bullish"
    elif total >= 55:
        direction = "Bullish"
    elif total >= 35 and bearish_signals < 3:
        direction = "Neutral"
    elif bearish_signals >= 4 or total < 20:
        direction = "Strong Bearish"
    else:
        direction = "Bearish"

    # ── Risk Level ──
    risk = "Medium"
    if atr and current_price and current_price > 0:
        atr_pct = (atr / current_price) * 100
        if atr_pct < 1.5:
            risk = "Low"
        elif atr_pct > 3.0:
            risk = "High"

    # ── Holding Period ──
    if atr and current_price and current_price > 0:
        atr_pct = (atr / current_price) * 100
        if atr_pct > 3.0:
            holding = "2-3 days"
        elif atr_pct > 1.5:
            holding = "3-5 days"
        else:
            holding = "5-7 days"
    else:
        holding = "3-5 days"

    # ── Entry Zone, Stop Loss, Targets ──
    entry_low = entry_high = stop_loss = target1 = target2 = None

    if current_price and atr:
        p = current_price
        a = atr
        sl_floor = (sma20 - a * 0.5) if sma20 else (p - a * 2)

        if "Bullish" in direction:
            entry_low  = round(p - a * 0.5, 2)
            entry_high = round(p, 2)
            stop_loss  = round(max(p - a * 2, sl_floor), 2)
            target1    = round(p + a * 1.5, 2)
            target2    = round(p + a * 2.5, 2)
        elif "Bearish" in direction:
            entry_low  = round(p, 2)
            entry_high = round(p + a * 0.5, 2)
            stop_loss  = round(p + a * 2, 2)
            target1    = round(p - a * 1.5, 2)
            target2    = round(p - a * 2.5, 2)
        else:  # Neutral
            entry_low  = round(p - a * 0.5, 2)
            entry_high = round(p + a * 0.5, 2)
            stop_loss  = round(p - a * 1.5, 2)
            target1    = round(p + a, 2)
            target2    = round(p + a * 1.5, 2)

    return {
        "opportunityScore": float(total),
        "direction":        direction,
        "riskLevel":        risk,
        "entryZoneLow":     entry_low,
        "entryZoneHigh":    entry_high,
        "stopLoss":         stop_loss,
        "target1":          target1,
        "target2":          target2,
        "holdingPeriod":    holding,
        "momentumScore":    float(momentum),
        "trendScore":       float(trend),
        "volumeScore":      float(vol_score),
        "volatilityScore":  float(vol_exp),
        "technicalScore":   float(tech),
        "greeksScore":      float(greeks_score),
    }


# ── Main sync ────────────────────────────────────────────────────────────────

def safe_float(val) -> Optional[float]:
    try:
        f = float(val)
        return None if (f != f) else f
    except (TypeError, ValueError):
        return None


def process_batch(conn, symbols: list) -> int:
    updated = 0
    try:
        data = yf.download(
            tickers=symbols,
            period=HISTORY_PERIOD,
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        log.error("yf.download failed for batch %s: %s", symbols, e)
        return 0

    tickers_obj = yf.Tickers(" ".join(symbols))

    for symbol in symbols:
        try:
            ticker = tickers_obj.tickers.get(symbol)
            info = {}
            try:
                info = ticker.info if ticker else {}
            except Exception:
                pass

            if len(symbols) == 1:
                hist_df = data
            else:
                try:
                    hist_df = data[symbol] if symbol in data.columns.get_level_values(0) else pd.DataFrame()
                except Exception:
                    hist_df = pd.DataFrame()

            if hist_df is None or hist_df.empty:
                log.warning("No history data for %s, skipping", symbol)
                continue

            hist_df = hist_df.dropna(subset=["Close"])
            closes  = hist_df["Close"].astype(float)
            highs   = hist_df["High"].astype(float) if "High" in hist_df.columns else None
            lows    = hist_df["Low"].astype(float) if "Low" in hist_df.columns else None
            volumes = hist_df["Volume"].astype(float) if "Volume" in hist_df.columns else None

            sparkline = closes.tail(SPARKLINE_DAYS).tolist()
            sparkline_pg = "{" + ",".join(str(v) for v in sparkline) + "}"

            current_price = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
            if current_price is None and not closes.empty:
                current_price = float(closes.iloc[-1])

            change_pct = safe_float(
                info.get("regularMarketChangePercent") or info.get("52WeekChange")
            )
            if change_pct is None and len(closes) >= 2:
                prev = float(closes.iloc[-2])
                curr = float(closes.iloc[-1])
                change_pct = ((curr - prev) / prev * 100) if prev else None

            stock_row = {
                "symbol":        symbol,
                "companyName":   info.get("longName") or info.get("shortName") or symbol,
                "sector":        info.get("sector"),
                "currentPrice":  current_price,
                "marketCap":     safe_float(info.get("marketCap")),
                "peRatio":       safe_float(info.get("trailingPE") or info.get("forwardPE")),
                "pbRatio":       safe_float(info.get("priceToBook")),
                "dividendYield": safe_float(info.get("dividendYield")),
                "dayHigh":       safe_float(info.get("dayHigh") or info.get("regularMarketDayHigh")),
                "dayLow":        safe_float(info.get("dayLow") or info.get("regularMarketDayLow")),
                "week52High":    safe_float(info.get("fiftyTwoWeekHigh")),
                "week52Low":     safe_float(info.get("fiftyTwoWeekLow")),
                "volume":        int(info["volume"]) if info.get("volume") else None,
                "changePercent": change_pct,
                "sparklineData": sparkline_pg,
            }

            upsert_stock(conn, stock_row)
            upsert_history(conn, symbol, hist_df)

            indicators = calc_indicators(closes, highs, lows, volumes)
            upsert_indicators(conn, symbol, indicators)

            opportunity = calc_opportunity(indicators, current_price)
            upsert_opportunity(conn, symbol, opportunity)

            conn.commit()
            updated += 1
            log.info(
                "✓ %s  price=%.2f  score=%.0f  dir=%s",
                symbol, current_price or 0,
                opportunity["opportunityScore"],
                opportunity["direction"],
            )

        except Exception as e:
            conn.rollback()
            log.error("Failed processing %s: %s", symbol, e)

    return updated


def run():
    t0 = time.time()
    conn = get_conn()
    log_id = log_sync_start(conn)
    log.info("Sync started — log_id=%s", log_id)

    total_updated = 0
    error_msg = None

    try:
        batches = [
            NIFTY100_SYMBOLS[i:i + BATCH_SIZE]
            for i in range(0, len(NIFTY100_SYMBOLS), BATCH_SIZE)
        ]
        log.info("Processing %d symbols in %d batches of %d",
                 len(NIFTY100_SYMBOLS), len(batches), BATCH_SIZE)

        for i, batch in enumerate(batches, 1):
            log.info("Batch %d/%d: %s", i, len(batches), ", ".join(batch))
            updated = process_batch(conn, batch)
            total_updated += updated
            if i < len(batches):
                time.sleep(2)

    except Exception as e:
        error_msg = str(e)
        log.error("Sync failed: %s", e)

    finally:
        log_sync_done(conn, log_id, total_updated, error_msg)
        conn.close()

    elapsed = round(time.time() - t0, 1)
    result = {
        "success":        error_msg is None,
        "stocksUpdated":  total_updated,
        "durationSeconds": elapsed,
        "error":          error_msg,
    }
    print(json.dumps(result))
    log.info("Sync complete — updated=%d  duration=%.1fs", total_updated, elapsed)
    return 0 if error_msg is None else 1


if __name__ == "__main__":
    sys.exit(run())
