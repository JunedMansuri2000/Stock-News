#!/usr/bin/env python3
"""
Stock Sync Script — fetches Nifty 100 data from Yahoo Finance,
calculates technical indicators, and upserts into PostgreSQL.

Usage:
  python scripts/stock_sync.py

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

BATCH_SIZE = 10        # Symbols per yf.download() batch
HISTORY_PERIOD = "1y"  # Fetch 1 year of history for indicators + charts
SPARKLINE_DAYS = 30    # Days of closing prices to store as sparkline


# ── Database ─────────────────────────────────────────────────────────────────

def get_conn():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(url)


def ensure_tables(conn):
    """Create tables if they don't exist yet (safety net — Prisma handles migrations)."""
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
        INSERT INTO "TechnicalIndicator" (id, symbol, sma20, sma50, sma200, rsi, macd, "macdSignal", "macdHist", "updatedAt")
        VALUES (gen_random_uuid()::text, %(symbol)s, %(sma20)s, %(sma50)s, %(sma200)s, %(rsi)s, %(macd)s, %(macdSignal)s, %(macdHist)s, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
            sma20       = EXCLUDED.sma20,
            sma50       = EXCLUDED.sma50,
            sma200      = EXCLUDED.sma200,
            rsi         = EXCLUDED.rsi,
            macd        = EXCLUDED.macd,
            "macdSignal"= EXCLUDED."macdSignal",
            "macdHist"  = EXCLUDED."macdHist",
            "updatedAt" = NOW()
    """
    ind["symbol"] = symbol
    with conn.cursor() as cur:
        cur.execute(sql, ind)


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

def calc_indicators(closes: pd.Series) -> dict:
    result = {
        "sma20": None, "sma50": None, "sma200": None,
        "rsi": None, "macd": None, "macdSignal": None, "macdHist": None,
    }
    if len(closes) < 14:
        return result

    def last_valid(series) -> Optional[float]:
        v = series.dropna()
        return float(v.iloc[-1]) if not v.empty else None

    try:
        result["sma20"]  = last_valid(ta.sma(closes, length=20))
        result["sma50"]  = last_valid(ta.sma(closes, length=50))
        result["sma200"] = last_valid(ta.sma(closes, length=200))
        result["rsi"]    = last_valid(ta.rsi(closes, length=14))
        macd_df = ta.macd(closes, fast=12, slow=26, signal=9)
        if macd_df is not None and not macd_df.empty:
            result["macd"]       = last_valid(macd_df.iloc[:, 0])
            result["macdSignal"] = last_valid(macd_df.iloc[:, 2])
            result["macdHist"]   = last_valid(macd_df.iloc[:, 1])
    except Exception as e:
        log.warning("Indicator calculation failed: %s", e)

    return result


# ── Main sync ────────────────────────────────────────────────────────────────

def safe_float(val) -> Optional[float]:
    try:
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def process_batch(conn, symbols: list[str]) -> int:
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
                info = ticker.fast_info if ticker else {}
                # fast_info is a FastInfo object, convert to dict-like access
                info = ticker.info if ticker else {}
            except Exception:
                pass

            # Extract history for this symbol
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
            closes = hist_df["Close"].astype(float)

            # Sparkline: last SPARKLINE_DAYS closing prices
            sparkline = closes.tail(SPARKLINE_DAYS).tolist()
            sparkline_pg = "{" + ",".join(str(v) for v in sparkline) + "}"

            # Current-day values
            current_price = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
            if current_price is None and not closes.empty:
                current_price = float(closes.iloc[-1])

            change_pct = safe_float(
                info.get("regularMarketChangePercent") or
                info.get("52WeekChange")
            )
            # Fallback: compute from last two closes
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

            indicators = calc_indicators(closes)
            upsert_indicators(conn, symbol, indicators)

            conn.commit()
            updated += 1
            log.info("✓ %s  price=%.2f  chg=%.2f%%", symbol,
                     current_price or 0, change_pct or 0)

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
            # Brief pause to avoid rate-limiting
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
        "success": error_msg is None,
        "stocksUpdated": total_updated,
        "durationSeconds": elapsed,
        "error": error_msg,
    }
    print(json.dumps(result))
    log.info("Sync complete — updated=%d  duration=%.1fs", total_updated, elapsed)
    return 0 if error_msg is None else 1


if __name__ == "__main__":
    sys.exit(run())
