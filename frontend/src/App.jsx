import React, { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '' // e.g. https://<your-backend>.onrender.com
const fmt = (x, d=2) => (x==null||isNaN(x) ? '-' : Number(x).toFixed(d))

const Badge = ({label, tone='neutral'}) => {
  const map = { bullish:'bg-green-100 text-green-700', bearish:'bg-red-100 text-red-700', watch:'bg-yellow-100 text-yellow-700', neutral:'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[tone]||map.neutral}`}>{label}</span>
}
const Tag = ({children}) => <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs mr-1">{children}</span>

function Card({row}){
  const tone = useMemo(()=>{
    if (row.signals?.some(s=>s.includes('BREAKOUT'))) return 'bullish'
    if (row.signals?.some(s=>s.includes('OVERSOLD'))) return 'watch'
    if (row.trend_short==='down' && row.trend_long==='down') return 'bearish'
    return 'neutral'
  },[row])
  return (
    <div className="rounded-2xl shadow p-4 border border-gray-100 bg-white w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{row.ticker}</h3>
          <Badge label={tone.toUpperCase()} tone={tone} />
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">${fmt(row.price)}</div>
          <div className="text-xs text-gray-500">chg {fmt(row.change)} ({fmt(row.change_pct)}%)</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-gray-500">RSI D/W/M</div><div><Tag>D {fmt(row.rsi_d)}</Tag><Tag>W {fmt(row.rsi_w)}</Tag><Tag>M {fmt(row.rsi_m)}</Tag></div></div>
        <div><div className="text-gray-500">MACD</div><div><Tag>Line {fmt(row.macd)}</Tag><Tag>Sig {fmt(row.macd_signal)}</Tag><Tag>Hist {fmt(row.macd_hist)}</Tag></div></div>
        <div><div className="text-gray-500">MA</div><div><Tag>EMA21 {fmt(row.ema21)}</Tag><Tag>SMA50 {fmt(row.sma50)}</Tag><Tag>SMA200 {fmt(row.sma200)}</Tag></div></div>
        <div><div className="text-gray-500">ADX/ATR</div><div><Tag>ADX {fmt(row.adx)}</Tag><Tag>ATR {fmt(row.atr)}</Tag></div></div>
        <div><div className="text-gray-500">Boll</div><div><Tag>U {fmt(row.bb_upper)}</Tag><Tag>M {fmt(row.bb_mid)}</Tag><Tag>L {fmt(row.bb_lower)}</Tag></div></div>
        <div><div className="text-gray-500">Donchian</div><div><Tag>H {fmt(row.dc_high)}</Tag><Tag>L {fmt(row.dc_low)}</Tag></div></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {row.signals?.map((s,i)=>(<Badge key={i} label={s} tone={s.includes('BREAKOUT')?'bullish': s.includes('SELL')?'bearish':'watch'} />))}
      </div>
    </div>
  )
}

export default function App(){
  const [tickers, setTickers] = useState('NVDA, APP, HOOD, ASTS')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [progress, setProgress] = useState(null)

  const fetchScan = async () => {
    try{
      setLoading(true); setErr('')
      const res = await fetch(`${API_BASE}/api/scan?tickers=${encodeURIComponent(tickers)}`)
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(data.results||[])
    }catch(e){ setErr(String(e)) }
    finally{ setLoading(false) }
  }

  const scanSP = async () => {
    try{
      setLoading(true); setErr(''); setProgress({done:0,total:1})
      const out = []
      const symsRes = await fetch(`${API_BASE}/api/sp500`)
      const { symbols } = await symsRes.json()
      const batchSize = 40
      const chunks = []
      for(let i=0;i<symbols.length;i+=batchSize) chunks.push(symbols.slice(i,i+batchSize))
      for(let i=0;i<chunks.length;i++){
        const qs = chunks[i].join(',')
        const res = await fetch(`${API_BASE}/api/scan?tickers=${encodeURIComponent(qs)}`)
        const data = await res.json()
        if(data?.results) out.push(...data.results)
        setProgress({done:i+1,total:chunks.length})
        await new Promise(r=>setTimeout(r,600))
      }
      setRows(out)
    }catch(e){ setErr(String(e)) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchScan() },[])

  return (
    <div className="min-h-screen" style={{background:'#0b0f19', color:'white', paddingBottom:'env(safe-area-inset-bottom)'}}>
      <header style={{position:'sticky',top:0, backdropFilter:'blur(6px)', background:'rgba(11,15,25,0.8)', borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <div style={{maxWidth:960, margin:'0 auto', padding:'12px 16px', display:'flex', gap:8, alignItems:'end', justifyContent:'space-between'}}>
          <div>
            <h1 style={{fontSize:22, fontWeight:800}}>Breakout Scanner</h1>
            <p style={{fontSize:12, opacity:.7}}>PWA • Installable on iPhone • Uses your FastAPI backend</p>
          </div>
          <div style={{display:'flex', gap:8}}>
            <input style={{padding:'8px 12px', borderRadius:12, background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'white', width:260}}
                   value={tickers} onChange={e=>setTickers(e.target.value)} placeholder="Tickers (comma-separated)" />
            <button onClick={fetchScan} style={{padding:'8px 12px', borderRadius:12, background:'#10b981', border:'none', color:'white'}}>Scan</button>
            <button onClick={scanSP} style={{padding:'8px 12px', borderRadius:12, background:'#6366f1', border:'none', color:'white'}}>Scan S&P 500</button>
          </div>
        </div>
      </header>

      {err && <div style={{maxWidth:960, margin:'12px auto 0', padding:12, borderRadius:12, background:'rgba(220,38,38,.2)', border:'1px solid rgba(248,113,113,.4)'}}>{err}</div>}
      {loading && <div style={{maxWidth:960, margin:'12px auto 0', padding:12, borderRadius:12, background:'rgba(255,255,255,.1)'}}>Loading… {progress ? `Batches ${progress.done}/${progress.total}` : ''}</div>}

      <main style={{maxWidth:960, margin:'0 auto', padding:16, display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))'}}>
        {rows.map(r => <Card key={r.ticker} row={r} />)}
      </main>

      <footer style={{maxWidth:960, margin:'0 auto', padding:16, fontSize:12, opacity:.6}}>
        Data via your backend. Educational use only. Not financial advice.
      </footer>
    </div>
  )
}
