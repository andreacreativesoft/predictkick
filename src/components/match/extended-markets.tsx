'use client'

import { useEffect, useState } from 'react'
import {
  Star,
  TrendingUp,
  CornerUpRight,
  CreditCard,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  Award,
  Timer,
  Shield,
} from 'lucide-react'

interface BestPick {
  market: string
  selection: string
  probability: number
  fair_odds: number
  confidence: string
  reasoning: string
  category: string
}

interface ExtendedMarketsData {
  markets: Record<string, unknown> & {
    best_pick: BestPick | null
    top_picks: BestPick[]
  }
  predicted_home_goals: number
  predicted_away_goals: number
  data_sources: Record<string, unknown>
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

function confidenceColor(c: string): string {
  if (c === 'foarte ridicată') return 'text-success'
  if (c === 'ridicată') return 'text-accent'
  if (c === 'medie') return 'text-warning'
  return 'text-muted'
}

function confidenceBg(c: string): string {
  if (c === 'foarte ridicată') return 'bg-success/10 border-success/20'
  if (c === 'ridicată') return 'bg-accent/10 border-accent/20'
  if (c === 'medie') return 'bg-warning/10 border-warning/20'
  return 'bg-card border-border'
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'goluri': return <Target className="w-3.5 h-3.5" />
    case 'cornere': return <CornerUpRight className="w-3.5 h-3.5" />
    case 'cartonașe': return <CreditCard className="w-3.5 h-3.5" />
    case 'rezultat': return <Shield className="w-3.5 h-3.5" />
    case 'combo': return <Zap className="w-3.5 h-3.5" />
    default: return <Star className="w-3.5 h-3.5" />
  }
}

function categoryLabel(cat: string) {
  switch (cat) {
    case 'goluri': return 'Goluri'
    case 'cornere': return 'Cornere'
    case 'cartonașe': return 'Cartonașe'
    case 'rezultat': return 'Rezultat'
    case 'combo': return 'Combo'
    default: return cat
  }
}

function MarketRow({ label, prob, highlight }: { label: string; prob: number; highlight?: boolean }) {
  const color = prob >= 0.7 ? 'text-success' : prob >= 0.5 ? 'text-accent' : prob >= 0.35 ? 'text-warning' : 'text-muted'
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight ? 'bg-accent/5 -mx-2 px-2 rounded' : ''}`}>
      <span className="text-xs text-foreground/80">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${prob >= 0.7 ? 'bg-success' : prob >= 0.5 ? 'bg-accent' : prob >= 0.35 ? 'bg-warning' : 'bg-muted'}`}
            style={{ width: `${Math.min(prob * 100, 100)}%` }} />
        </div>
        <span className={`text-xs font-semibold w-10 text-right ${color}`}>{pct(prob)}</span>
      </div>
    </div>
  )
}

export function ExtendedMarketsPanel({ fixtureId }: { fixtureId: string }) {
  const [data, setData] = useState<ExtendedMarketsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    goluri: true,
    rezultat: false,
    cornere: false,
    cartonase: false,
    repriza: false,
  })

  useEffect(() => {
    fetch(`/api/predictions/extended?fixture_id=${fixtureId}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [fixtureId])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
          <div className="w-48 h-5 bg-background rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="w-full h-4 bg-background rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.markets) return null

  const m = data.markets
  const bestPick = m.best_pick
  const topPicks = m.top_picks || []

  const toggleSection = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-4">
      {/* ===== CEL MAI BUN PARIU ===== */}
      {bestPick && (
        <div className={`border rounded-xl p-5 ${confidenceBg(bestPick.confidence)}`}>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-accent" /> Cel Mai Bun Pariu
          </h3>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
              {categoryIcon(bestPick.category)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground">{bestPick.market}</p>
              <p className="text-xs text-muted mt-0.5">{bestPick.reasoning}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-semibold text-accent">{pct(bestPick.probability)} prob.</span>
                <span className="text-xs text-muted">Cotă corectă: {bestPick.fair_odds}</span>
                <span className={`text-xs font-semibold ${confidenceColor(bestPick.confidence)}`}>
                  {bestPick.confidence}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TOP PICKS ===== */}
      {topPicks.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-warning" /> Top Predicții
          </h3>
          <div className="space-y-2">
            {topPicks.slice(0, 6).map((pick, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold text-muted w-4">{i + 1}</span>
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-background text-muted">
                    {categoryIcon(pick.category)}
                    {categoryLabel(pick.category)}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{pick.market}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`text-xs font-bold ${
                    pick.probability >= 0.7 ? 'text-success' : pick.probability >= 0.5 ? 'text-accent' : 'text-warning'
                  }`}>{pct(pick.probability)}</span>
                  <span className="text-[10px] text-muted">@{pick.fair_odds}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== GOLURI ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('goluri')}
          className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" /> Goluri
            <span className="text-[10px] text-muted font-normal ml-1">
              (Așteptat: {data.predicted_home_goals.toFixed(1)} - {data.predicted_away_goals.toFixed(1)})
            </span>
          </h3>
          {expanded.goluri ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {expanded.goluri && (
          <div className="px-4 pb-4 space-y-0">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-2">Peste / Sub</div>
            <MarketRow label="Peste 0.5 Goluri" prob={m.over_05 as number} />
            <MarketRow label="Peste 1.5 Goluri" prob={m.over_15 as number} highlight />
            <MarketRow label="Peste 2.5 Goluri" prob={m.over_25 as number} />
            <MarketRow label="Peste 3.5 Goluri" prob={m.over_35 as number} />
            <MarketRow label="Peste 4.5 Goluri" prob={m.over_45 as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">GG / NG</div>
            <MarketRow label="GG (Ambele Marchează)" prob={m.btts_yes as number} />
            <MarketRow label="NG (Nu Ambele)" prob={m.btts_no as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Combo</div>
            <MarketRow label="GG + Peste 2.5" prob={m.btts_over_25 as number} />
            <MarketRow label="GG + Sub 3.5" prob={m.btts_under_35 as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Goluri Exacte</div>
            <MarketRow label="Total 0 goluri" prob={m.total_0_goals as number} />
            <MarketRow label="Total 1 gol" prob={m.total_1_goal as number} />
            <MarketRow label="Total 2 goluri" prob={m.total_2_goals as number} />
            <MarketRow label="Total 3 goluri" prob={m.total_3_goals as number} />
            <MarketRow label="Total 4+ goluri" prob={m.total_4plus_goals as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Fără Gol Primit</div>
            <MarketRow label="Gazde - Fără Gol Primit" prob={m.home_clean_sheet as number} />
            <MarketRow label="Oaspeți - Fără Gol Primit" prob={m.away_clean_sheet as number} />
          </div>
        )}
      </div>

      {/* ===== REZULTAT ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('rezultat')}
          className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" /> Rezultat
          </h3>
          {expanded.rezultat ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {expanded.rezultat && (
          <div className="px-4 pb-4 space-y-0">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-2">Șansă Dublă</div>
            <MarketRow label="1X (Gazde sau Egal)" prob={m.home_or_draw as number} />
            <MarketRow label="X2 (Egal sau Oaspeți)" prob={m.away_or_draw as number} />
            <MarketRow label="12 (Fără Egal)" prob={m.home_or_away as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Draw No Bet</div>
            <MarketRow label="DNB Gazde" prob={m.dnb_home as number} />
            <MarketRow label="DNB Oaspeți" prob={m.dnb_away as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Victorie la Zero</div>
            <MarketRow label="Gazde câștigă la 0" prob={m.home_win_to_nil as number} />
            <MarketRow label="Oaspeți câștigă la 0" prob={m.away_win_to_nil as number} />

            <div className="text-[10px] text-muted uppercase tracking-wider mb-2 mt-3">Primul Gol</div>
            <MarketRow label="Gazde marchează primele" prob={m.home_first_goal as number} />
            <MarketRow label="Oaspeți marchează primele" prob={m.away_first_goal as number} />
            <MarketRow label="Fără gol" prob={m.no_goal as number} />
          </div>
        )}
      </div>

      {/* ===== PRIMA REPRIZĂ ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('repriza')}
          className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Timer className="w-4 h-4 text-accent" /> Prima Repriză
          </h3>
          {expanded.repriza ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {expanded.repriza && (
          <div className="px-4 pb-4 space-y-0">
            <MarketRow label="Peste 0.5 Goluri R1" prob={m.ht_over_05 as number} />
            <MarketRow label="Peste 1.5 Goluri R1" prob={m.ht_over_15 as number} />
            <MarketRow label="GG Prima Repriză" prob={m.ht_btts_yes as number} />
          </div>
        )}
      </div>

      {/* ===== CORNERE ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('cornere')}
          className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CornerUpRight className="w-4 h-4 text-accent" /> Cornere
            <span className="text-[10px] text-muted font-normal ml-1">
              (Așteptat: {(m.expected_corners as number).toFixed(1)} total)
            </span>
          </h3>
          {expanded.cornere ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {expanded.cornere && (
          <div className="px-4 pb-4 space-y-0">
            <MarketRow label="Peste 8.5 Cornere" prob={m.corners_over_85 as number} />
            <MarketRow label="Peste 9.5 Cornere" prob={m.corners_over_95 as number} highlight />
            <MarketRow label="Peste 10.5 Cornere" prob={m.corners_over_105 as number} />
            <MarketRow label="Peste 11.5 Cornere" prob={m.corners_over_115 as number} />
          </div>
        )}
      </div>

      {/* ===== CARTONAȘE ===== */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('cartonase')}
          className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
        >
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-warning" /> Cartonașe
            <span className="text-[10px] text-muted font-normal ml-1">
              (Așteptat: {m.expected_cards as number} total)
            </span>
          </h3>
          {expanded.cartonase ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {expanded.cartonase && (
          <div className="px-4 pb-4 space-y-0">
            <MarketRow label="Peste 2.5 Cartonașe" prob={m.cards_over_25 as number} />
            <MarketRow label="Peste 3.5 Cartonașe" prob={m.cards_over_35 as number} highlight />
            <MarketRow label="Peste 4.5 Cartonașe" prob={m.cards_over_45 as number} />
            <MarketRow label="Peste 5.5 Cartonașe" prob={m.cards_over_55 as number} />
          </div>
        )}
      </div>

      {/* Data sources info */}
      <div className="text-[10px] text-muted text-center py-1">
        {`Model Poisson · Date: ${Number(data.data_sources?.home_fixtures_used) || 0} meciuri gazde, ${Number(data.data_sources?.away_fixtures_used) || 0} meciuri oaspeți${data.data_sources?.referee ? ` · Arbitru: ${String(data.data_sources.referee)}` : ''}`}
      </div>
    </div>
  )
}
