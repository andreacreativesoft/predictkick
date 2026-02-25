'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp,
  Scale,
  Zap,
  Cloud,
  Shield,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Newspaper,
  UserX,
} from 'lucide-react'

// ==========================================
// Types
// ==========================================

interface OddsRow {
  key: string
  name: string
  home: number
  draw: number
  away: number
  isRomanian: boolean
}

interface ValueAlert {
  bookmaker: string
  selection: string
  romanian_odds: number
  international_avg: number
  edge_pct: number
}

interface ValueBet {
  selection: string
  edge: number
  best_odds: number
  bookmaker: string
  kelly_stake_pct: number
}

interface WeatherData {
  pre_temperature: number
  pre_wind_speed: number
  pre_rain_probability: number
  pre_condition: string
  weather_impact_description?: string
}

interface InjuredPlayer {
  id: string
  player_name: string
  team_name: string
  status: string
  reason: string
  expected_return: string | null
  impact_on_team: number
}

interface NewsItem {
  id: string
  factor_type: string
  title: string
  source: string | null
  source_url: string | null
  sentiment: string
  impact_score: number
}

interface MatchSidebarProps {
  fixtureId: string
  roRows: OddsRow[]
  intlRows: OddsRow[]
  valueBets: ValueBet[]
  alerts: ValueAlert[]
  weather: WeatherData | null
  venue: string | null
  referee: string | null
  modelVersion: string | null
  homeTeamId: string
  awayTeamId: string
  bookmakerLabels: Record<string, string>
}

// ==========================================
// Top 5 European bookmakers (by reputation/volume)
// ==========================================

const TOP_EUROPEAN_BOOKMAKERS = new Set([
  'bet365', 'williamhill', 'unibet', 'unibet_eu', 'betfair_sb_uk',
  'pinnacle', 'betway', 'paddypower', 'betsson', 'sport888',
])

export function MatchSidebar({
  fixtureId, roRows, intlRows, valueBets, alerts,
  weather, venue, referee, modelVersion,
  homeTeamId, awayTeamId, bookmakerLabels,
}: MatchSidebarProps) {
  const [oddsOpen, setOddsOpen] = useState(false)
  const [injuries, setInjuries] = useState<InjuredPlayer[]>([])
  const [news, setNews] = useState<NewsItem[]>([])

  // Fetch injuries and news for this match
  useEffect(() => {
    // Fetch injuries
    fetch(`/api/injuries?home_team_id=${homeTeamId}&away_team_id=${awayTeamId}`)
      .then(r => r.json())
      .then(d => setInjuries(d.injuries || []))
      .catch(() => {})

    // Fetch news for this fixture
    fetch(`/api/news/match?fixture_id=${fixtureId}`)
      .then(r => r.json())
      .then(d => setNews(d.news || []))
      .catch(() => {})
  }, [fixtureId, homeTeamId, awayTeamId])

  // Compute best odds from ALL real bookmaker data
  const allRows = [...roRows, ...intlRows].filter(r => r.home > 0 && r.draw > 0 && r.away > 0)
  const bestHome = Math.max(...allRows.map(r => r.home), 0)
  const bestDraw = Math.max(...allRows.map(r => r.draw), 0)
  const bestAway = Math.max(...allRows.map(r => r.away), 0)
  const bestHomeBk = allRows.find(r => r.home === bestHome)
  const bestDrawBk = allRows.find(r => r.draw === bestDraw)
  const bestAwayBk = allRows.find(r => r.away === bestAway)

  // Filter international to top 5 European + all Romanian
  const topIntl = intlRows
    .filter(r => TOP_EUROPEAN_BOOKMAKERS.has(r.key))
    .sort((a, b) => b.home - a.home)
    .slice(0, 5)

  // Computed averages from all data
  const avgHome = allRows.length > 0 ? allRows.reduce((s, r) => s + r.home, 0) / allRows.length : 0
  const avgDraw = allRows.length > 0 ? allRows.reduce((s, r) => s + r.draw, 0) / allRows.length : 0
  const avgAway = allRows.length > 0 ? allRows.reduce((s, r) => s + r.away, 0) / allRows.length : 0

  return (
    <div className="space-y-4">
      {/* ===== CELE MAI BUNE COTE ===== */}
      {allRows.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Cele Mai Bune Cote</h3>
          <div className="space-y-2">
            {[
              { label: 'Gazde', odds: bestHome, book: bestHomeBk?.name || '' },
              { label: 'Egal', odds: bestDraw, book: bestDrawBk?.name || '' },
              { label: 'Oaspeți', odds: bestAway, book: bestAwayBk?.name || '' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2 bg-background rounded-lg">
                <span className="text-xs text-muted">{item.label}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-success">{item.odds.toFixed(2)}</span>
                  <span className="text-[10px] text-muted ml-1">{item.book}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PARIURI DE VALOARE ===== */}
      {valueBets.length > 0 && (
        <div className="bg-card border border-success/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Pariuri de Valoare
          </h3>
          <div className="space-y-2">
            {valueBets.map((vb, i) => (
              <div key={i} className="p-2 bg-success/5 rounded-lg border border-success/10">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-foreground capitalize">{vb.selection}</span>
                  <span className="text-xs font-bold text-success">+{(vb.edge * 100).toFixed(1)}% edge</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted">@ {vb.best_odds.toFixed(2)} ({vb.bookmaker})</span>
                  <span className="text-[10px] text-muted">Kelly: {vb.kelly_stake_pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== VALUE ALERTS ===== */}
      {alerts.length > 0 && (
        <div className="bg-card border border-success/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Alerte de Valoare
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="p-2 bg-success/5 rounded-lg border border-success/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-foreground">
                    🇷🇴 {bookmakerLabels[alert.bookmaker] || alert.bookmaker}
                  </span>
                  <span className="text-xs font-bold text-success">+{alert.edge_pct.toFixed(1)}% edge</span>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  {alert.selection} @ {alert.romanian_odds.toFixed(2)} vs intl avg {alert.international_avg.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== JUCĂTORI INDISPONIBILI ===== */}
      {injuries.length > 0 && (
        <div className="bg-card border border-danger/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <UserX className="w-4 h-4 text-danger" /> Jucători Indisponibili
          </h3>
          <div className="space-y-2">
            {injuries.slice(0, 8).map((inj) => (
              <div key={inj.id} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{inj.player_name}</p>
                  <p className="text-[10px] text-muted">{inj.team_name} · {inj.reason}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ml-2 ${
                  inj.status === 'injured' ? 'bg-danger/10 text-danger' :
                  inj.status === 'suspended' ? 'bg-warning/10 text-warning' :
                  inj.status === 'doubtful' ? 'bg-warning/10 text-warning' :
                  'bg-muted/10 text-muted'
                }`}>
                  {inj.status === 'injured' ? 'Accidentat' :
                   inj.status === 'suspended' ? 'Suspendat' :
                   inj.status === 'doubtful' ? 'Incert' : inj.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ȘTIRI MECI ===== */}
      {news.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-accent" /> Știri Meci
          </h3>
          <div className="space-y-2">
            {news.slice(0, 5).map((item) => (
              <div key={item.id} className="py-1.5 border-b border-border/20 last:border-0">
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                    item.factor_type === 'injury_news' ? 'text-danger' :
                    item.factor_type === 'scandal' ? 'text-warning' : 'text-accent'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-snug line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.source && <span className="text-[10px] text-muted">{item.source}</span>}
                      <span className={`text-[10px] ${
                        item.sentiment === 'negative' ? 'text-danger' : 'text-muted'
                      }`}>Impact: {(item.impact_score * 10).toFixed(0)}/10</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== METEO ===== */}
      {weather && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Cloud className="w-4 h-4 text-accent" /> Meteo
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted">Temp:</span> <span className="text-foreground">{weather.pre_temperature}°C</span></div>
            <div><span className="text-muted">Vânt:</span> <span className="text-foreground">{weather.pre_wind_speed} m/s</span></div>
            <div><span className="text-muted">Ploaie:</span> <span className="text-foreground">{weather.pre_rain_probability}%</span></div>
            <div><span className="text-muted">Condiții:</span> <span className="text-foreground capitalize">{weather.pre_condition}</span></div>
          </div>
          {weather.weather_impact_description && (
            <p className="text-[10px] text-muted mt-2 pt-2 border-t border-border">{weather.weather_impact_description}</p>
          )}
        </div>
      )}

      {/* ===== INFO MECI ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" /> Info Meci
        </h3>
        <div className="space-y-2 text-xs">
          {venue && <div><span className="text-muted">Stadion:</span> <span className="text-foreground">{venue}</span></div>}
          {referee && <div><span className="text-muted">Arbitru:</span> <span className="text-foreground">{referee}</span></div>}
          {modelVersion && <div><span className="text-muted">Model:</span> <span className="text-foreground">{modelVersion}</span></div>}
        </div>
      </div>

      {/* ===== TOATE COTELE (collapsible, last) ===== */}
      {allRows.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setOddsOpen(!oddsOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-card-hover transition-colors"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent" /> Toate Cotele
              <span className="text-[10px] text-muted font-normal">({allRows.length} case de pariuri)</span>
            </h3>
            {oddsOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>
          {oddsOpen && (
            <div className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted py-2 font-medium">Casa</th>
                      <th className="text-center text-muted py-2 font-medium w-16">1</th>
                      <th className="text-center text-muted py-2 font-medium w-16">X</th>
                      <th className="text-center text-muted py-2 font-medium w-16">2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Romanian bookmakers */}
                    {roRows.length > 0 && (
                      <tr><td colSpan={4} className="pt-2 pb-1 text-[10px] font-semibold text-accent uppercase tracking-wider">Piața Românească</td></tr>
                    )}
                    {roRows.map((row) => (
                      <tr key={row.key} className="border-b border-border/30 hover:bg-card-hover transition-colors">
                        <td className="py-1.5 font-medium text-foreground flex items-center gap-1.5">
                          <span className="text-[10px]">🇷🇴</span>
                          {row.name}
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`font-semibold ${row.home === bestHome ? 'text-success' : 'text-foreground'}`}>{row.home.toFixed(2)}</span>
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`font-semibold ${row.draw === bestDraw ? 'text-success' : 'text-foreground'}`}>{row.draw.toFixed(2)}</span>
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`font-semibold ${row.away === bestAway ? 'text-success' : 'text-foreground'}`}>{row.away.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}

                    {/* International Top 5 */}
                    <tr><td colSpan={4} className="pt-3 pb-1 text-[10px] font-semibold text-accent uppercase tracking-wider">Top Europa</td></tr>
                    {avgHome > 0 && (
                      <tr className="border-b border-border/50 bg-accent/5">
                        <td className="py-1.5 text-muted font-medium flex items-center gap-1.5">
                          <span className="text-[10px]">📊</span>
                          Medie
                        </td>
                        <td className="text-center py-1.5 text-muted font-medium">{avgHome.toFixed(2)}</td>
                        <td className="text-center py-1.5 text-muted font-medium">{avgDraw.toFixed(2)}</td>
                        <td className="text-center py-1.5 text-muted font-medium">{avgAway.toFixed(2)}</td>
                      </tr>
                    )}
                    {topIntl.map((row) => (
                      <tr key={row.key} className="border-b border-border/20 hover:bg-card-hover transition-colors">
                        <td className="py-1.5 text-foreground/80 flex items-center gap-1.5">
                          <span className="text-[10px]">🌍</span>
                          {row.name}
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`${row.home === bestHome ? 'font-bold text-success' : 'text-foreground/80'}`}>{row.home.toFixed(2)}</span>
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`${row.draw === bestDraw ? 'font-bold text-success' : 'text-foreground/80'}`}>{row.draw.toFixed(2)}</span>
                        </td>
                        <td className="text-center py-1.5">
                          <span className={`${row.away === bestAway ? 'font-bold text-success' : 'text-foreground/80'}`}>{row.away.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
