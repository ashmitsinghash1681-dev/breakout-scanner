from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta

app = FastAPI(title="Breakout Scanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
)

def compute_indicators(df: pd.DataFrame) -> dict:
    out = {}
    if df.empty or len(df) < 60:
        return out
    df = df.copy()

    # RSI daily/weekly/monthly
    df["rsi_d"] = ta.rsi(df["Close"], length=14)
    w = df.resample("W").last()
    m = df.resample("M").last()
    out["rsi_d"] = float(df["rsi_d"].iloc[-1])
    out["rsi_w"] = float(ta.rsi(w["Close"], length=14).iloc[-1]) if len(w) >= 14 else None
    out["rsi_m"] = float(ta.rsi(m["Close"], length=14).iloc[-1]) if len(m) >= 14 else None

    # MACD
    macd = ta.macd(df["Close"], fast=12, slow=26, signal=9)
    out["macd"] = float(macd["MACD_12_26_9"].iloc[-1])
    out["macd_signal"] = float(macd["MACDs_12_26_9"].iloc[-1])
    out["macd_hist"] = float(macd["MACDh_12_26_9"].iloc[-1])

    # Moving averages
    out["ema21"] = float(ta.ema(df["Close"], length=21).iloc[-1])
    out["sma50"] = float(ta.sma(df["Close"], length=50).iloc[-1])
    out["sma200"] = float(ta.sma(df["Close"], length=200).iloc[-1]) if len(df) >= 200 else None

    # ADX / ATR
    adx = ta.adx(df["High"], df["Low"], df["Close"], length=14)
    out["adx"] = float(adx["ADX_14"].iloc[-1])
    out["atr"] = float(ta.atr(df["High"], df["Low"], df["Close"], length=14).iloc[-1])

    # Bollinger (20,2)
    bb = ta.bbands(df["Close"], length=20, std=2)
    out["bb_upper"] = float(bb.iloc[-1, 0])
    out["bb_mid"]   = float(bb.iloc[-1, 1])
    out["bb_lower"] = float(bb.iloc[-1, 2])

    # Donchian (20)
    out["dc_high"] = float(df["High"].rolling(20).max().iloc[-1])
    out["dc_low"]  = float(df["Low"].rolling(20).min().iloc[-1])

    # Supertrend (10,3)
    st = ta.supertrend(df["High"], df["Low"], df["Close"], length=10, multiplier=3.0)
    out["supertrend"] = int(st.iloc[-1, -1] > 0)

    # Volume + price deltas
    out["volume"]   = float(df["Volume"].iloc[-1])
    out["vol_avg20"] = float(df["Volume"].rolling(20).mean().iloc[-1])

    close = df["Close"].iloc[-1]
    prev  = df["Close"].iloc[-2]
    change = close - prev
    change_pct = (change / prev) * 100 if prev else 0.0

    # Signals
    signals = []
    if close > out["dc_high"] * 0.999:
        signals.append("BREAKOUT: Donchian High")
    if out["rsi_d"] is not None and out["rsi_d"] <= 35:
        signals.append("OVERSOLD: RSI<=35")
    if out["rsi_d"] is not None and out["rsi_d"] >= 70:
        signals.append("OVERBOUGHT: RSI>=70")
    if out["macd"] is not None and out["macd_signal"] is not None:
        if out["macd"] > out["macd_signal"]:
            signals.append("BULLISH: MACD Crossover")
    if out.get("sma200") and out["sma50"] and out["sma50"] > out["sma200"]:
        signals.append("BULLISH: Golden Cross 50/200")

    out.update({
        "price": float(close),
        "change": float(change),
        "change_pct": float(change_pct),
        "signals": signals,
        "trend_short": "up" if close > out["ema21"] else "down",
        "trend_long": "up" if (out.get("sma200") and close > out["sma200"]) else "down",
    })
    return out

@app.get("/api/scan")
def scan(tickers: str = Query(..., description="Comma separated tickers e.g. NVDA, AAPL")):
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    results = []
    for sym in symbols:
        try:
            data = yf.download(sym, period="9mo", interval="1d", auto_adjust=True, progress=False)
            if data is None or data.empty:
                results.append({"ticker": sym, "error": "No data"})
                continue
            data.index = pd.to_datetime(data.index)
            ind = compute_indicators(data)
            results.append({"ticker": sym, **ind})
        except Exception as e:
            results.append({"ticker": sym, "error": str(e)})
    return {"results": results}

# S&P 500 (short starter list — expand later)
SP500_SYMBOLS = [
    "AAPL","MSFT","NVDA","GOOGL","AMZN","META","JPM","V","UNH","PG",
    "AVGO","XOM","COST","HD","LLY","BAC","KO","PEP","CSCO","WMT"
]

@app.get("/api/sp500")
def get_sp500():
    return {"symbols": SP500_SYMBOLS}
