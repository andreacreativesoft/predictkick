import { Zap, Shield, TrendingUp, Target, AlertTriangle, Trophy, Layers, Calculator, Crown, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ----- Type definitions for Supabase result casting -----

interface TeamRef {
  name: string
  short_name: string | null
  logo_url: string | null
}

interface LeagueRef {
  name: string
  country: string
}

interface DominantTeamRow {
  id: string
  team_id: string
  dominance_level: string
  dominance_score: number
  win_rate: number // stored as decimal 0-1
  ppg: number
  form_score: number // stored as decimal 0-1
  home_win_rate: number
  away_win_rate: number
  min_odds_threshold: number
  team: TeamRef | null
  league: LeagueRef | null
}

interface PickFixture {
  match_date: string
  home_team: TeamRef | null
  away_team: TeamRef | null
  league: { name: string } | null
}

interface AccumulatorPickRow {
  id: string
  match_date: string
  team_id: string
  team_name: string
  opponent_name: string
  is_home: boolean
  safety_score: number
  recommended_market: string
  current_odds: number
  min_odds_threshold: number
  confidence: string
  risk_factors: unknown
  fixture: PickFixture | null
}

interface AccumulatorComboRow {
  id: string
  combo_date: string
  risk_level: string
  picks: unknown
  total_odds: number
  expected_win_rate: number
  expected_value: number
  suggested_stake_pct: number
  projected_roi: number
  hit_rate_needed: number
  recovery_after_loss: number
  created_at: string
}

interface AccumulatorPerformanceRow {
  id: string
  season: string
  total_combos: number
  won_combos: number
  lost_combos: number
  hit_rate: number
  roi: number
  current_streak: number
  longest_winning_streak: number
  longest_losing_streak: number
  monthly_results: unknown
}

// ----- Page Component -----

export default async function AccumulatorsPage() {
  const supabase = await createClient()

  // Fetch dominant teams
  const { data: rawDominantTeams } = await supabase
    .from('dominant_teams')
    .select('*, team:teams(name, short_name, logo_url), league:leagues(name, country)')
    .in('dominance_level', ['ultra', 'strong', 'moderate'])
    .order('dominance_score', { ascending: false })

  const dominantTeams = (rawDominantTeams || []) as unknown as DominantTeamRow[]

  // Fetch today's picks (next 3 days)
  const today = new Date().toISOString().split('T')[0]
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: rawPicks } = await supabase
    .from('accumulator_picks')
    .select(`
      *,
      fixture:fixtures(
        match_date,
        home_team:teams!fixtures_home_team_id_fkey(name, short_name, logo_url),
        away_team:teams!fixtures_away_team_id_fkey(name, short_name, logo_url),
        league:leagues!fixtures_league_id_fkey(name)
      )
    `)
    .gte('match_date', today)
    .lte('match_date', threeDays)
    .is('result', null)
    .order('safety_score', { ascending: false })

  const picks = (rawPicks || []) as unknown as AccumulatorPickRow[]

  // Fetch today's combos
  const { data: rawCombos } = await supabase
    .from('accumulator_combos')
    .select('*')
    .gte('combo_date', today)
    .order('created_at', { ascending: false })
    .limit(20)

  const combos = (rawCombos || []) as unknown as AccumulatorComboRow[]

  // Fetch season performance (football season starts July, so use year-1 if before July)
  const now2 = new Date()
  const season = (now2.getMonth() >= 6 ? now2.getFullYear() : now2.getFullYear() - 1).toString()
  const { data: rawPerformance } = await supabase
    .from('accumulator_performance')
    .select('*')
    .eq('season', season)

  const performanceRows = (rawPerformance || []) as unknown as AccumulatorPerformanceRow[]
  const performance = performanceRows.length > 0 ? performanceRows[0] : null

  // Group combos by risk level
  const conservativeCombos = combos.filter((c) => String(c.risk_level) === 'conservative')
  const moderateCombos = combos.filter((c) => String(c.risk_level) === 'moderate')
  const aggressiveCombos = combos.filter((c) => String(c.risk_level) === 'aggressive')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-6 h-6 text-accent" /> Accumulator Builder
        </h1>
        <p className="text-sm text-muted mt-1">
          AI-powered safe picks from dominant teams
        </p>
      </div>

      {/* ===== SECTION 1: Dominant Teams Panel ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4 text-warning" /> Dominant Teams
        </h3>
        {dominantTeams.length === 0 ? (
          <div className="text-center py-8">
            <Crown className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No dominant teams loaded</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Run the generate-accumulators cron job to populate dominant team data.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {dominantTeams.map((dt) => {
              const teamName = dt.team ? String(dt.team.name) : 'Unknown'
              const leagueName = dt.league ? String(dt.league.name) : '--'
              const level = String(dt.dominance_level).toUpperCase()
              const levelColor =
                level === 'ULTRA' ? 'bg-danger/10 text-danger' :
                level === 'STRONG' ? 'bg-warning/10 text-warning' :
                'bg-accent/10 text-accent'

              return (
                <div
                  key={String(dt.id)}
                  className="min-w-[220px] bg-background border border-border rounded-lg p-4 flex-shrink-0 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{teamName}</p>
                      <p className="text-[10px] text-muted">{leagueName}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${levelColor}`}>
                      {level}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted">Win Rate</span>
                      <p className="text-foreground font-semibold">{(Number(dt.win_rate) * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <span className="text-muted">PPG</span>
                      <p className="text-foreground font-semibold">{Number(dt.ppg).toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted">H/A Win</span>
                      <p className="text-foreground font-semibold">
                        <span className="text-success">{(Number(dt.home_win_rate) * 100).toFixed(0)}%</span>
                        <span className="text-muted mx-0.5">/</span>
                        <span className="text-accent">{(Number(dt.away_win_rate) * 100).toFixed(0)}%</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted">Min Odds</span>
                      <p className="text-foreground font-semibold">{Number(dt.min_odds_threshold).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 2: Today's Picks ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" /> Today&apos;s Picks
        </h3>
        {picks.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No picks available</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Picks are generated daily from dominant team matchups. Run the generate-accumulators cron job to create picks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {picks.map((pick) => {
              const safetyScore = Number(pick.safety_score)
              const safetyColor =
                safetyScore > 80 ? 'bg-success' :
                safetyScore > 65 ? 'bg-warning' :
                'bg-danger'
              const safetyTextColor =
                safetyScore > 80 ? 'text-success' :
                safetyScore > 65 ? 'text-warning' :
                'text-danger'
              const currentOdds = Number(pick.current_odds)
              const minThreshold = Number(pick.min_odds_threshold)
              const oddsOk = currentOdds >= minThreshold
              const riskFactors = Array.isArray(pick.risk_factors) ? pick.risk_factors : []
              const confidenceStr = String(pick.confidence || 'medium').toUpperCase()
              const confidenceColor =
                confidenceStr === 'HIGH' ? 'bg-success/10 text-success' :
                confidenceStr === 'MEDIUM' ? 'bg-warning/10 text-warning' :
                'bg-danger/10 text-danger'

              const homeTeamName = pick.fixture?.home_team
                ? String(pick.fixture.home_team.short_name || pick.fixture.home_team.name)
                : String(pick.team_name || 'TBD')
              const awayTeamName = pick.fixture?.away_team
                ? String(pick.fixture.away_team.short_name || pick.fixture.away_team.name)
                : String(pick.opponent_name || 'TBD')

              return (
                <div
                  key={String(pick.id)}
                  className="bg-background border border-border rounded-lg p-4 hover:border-accent/30 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {homeTeamName} vs {awayTeamName}
                        </p>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          pick.is_home ? 'bg-accent/10 text-accent' : 'bg-muted/20 text-muted'
                        }`}>
                          {pick.is_home ? 'HOME' : 'AWAY'}
                        </span>
                      </div>
                      {pick.fixture?.league ? (
                        <p className="text-[10px] text-muted">{String(pick.fixture.league.name)}</p>
                      ) : null}
                    </div>

                    {/* Safety score */}
                    <div className="w-32 flex-shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted">Safety</span>
                        <span className={`text-xs font-bold ${safetyTextColor}`}>{safetyScore.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${safetyColor}`}
                          style={{ width: `${Math.min(safetyScore, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Market */}
                    <div className="text-center flex-shrink-0 w-20">
                      <p className="text-[10px] text-muted">Market</p>
                      <p className="text-xs font-semibold text-foreground uppercase">
                        {String(pick.recommended_market || '--')}
                      </p>
                    </div>

                    {/* Odds */}
                    <div className="text-center flex-shrink-0 w-28">
                      <p className="text-[10px] text-muted">Odds vs Threshold</p>
                      <p className="text-xs font-semibold">
                        <span className={oddsOk ? 'text-success' : 'text-danger'}>
                          {currentOdds.toFixed(2)}
                        </span>
                        <span className="text-muted mx-1">/</span>
                        <span className="text-muted">{minThreshold.toFixed(2)}</span>
                      </p>
                    </div>

                    {/* Confidence */}
                    <div className="flex-shrink-0">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${confidenceColor}`}>
                        {confidenceStr}
                      </span>
                    </div>

                    {/* Risk factors */}
                    {riskFactors.length > 0 ? (
                      <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[200px]">
                        {riskFactors.slice(0, 3).map((factor, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-danger/10 text-danger text-[10px] rounded flex items-center gap-0.5"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {String(factor)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 3: Suggested Accumulators ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-warning" /> Suggested Accumulators
        </h3>
        {combos.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No accumulators built yet</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Accumulator combos are generated daily after picks are scored. Run the generate-accumulators cron job.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Risk level sections */}
            <ComboSection
              title="Conservative"
              description="Low risk, high probability"
              combos={conservativeCombos}
              colorClass="text-success"
              bgClass="bg-success/10"
              icon={Shield}
            />
            <ComboSection
              title="Moderate"
              description="Balanced risk and reward"
              combos={moderateCombos}
              colorClass="text-warning"
              bgClass="bg-warning/10"
              icon={TrendingUp}
            />
            <ComboSection
              title="Aggressive"
              description="Higher odds, higher risk"
              combos={aggressiveCombos}
              colorClass="text-danger"
              bgClass="bg-danger/10"
              icon={Zap}
            />
          </div>
        )}
      </div>

      {/* ===== SECTION 4: Season Performance ===== */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" /> Season Performance
        </h3>
        {!performance ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No performance data yet</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              Season performance is tracked once accumulators start settling. Run the generate-accumulators cron job to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <PerfStatCard
                label="Total Combos"
                value={String(Number(performance.total_combos))}
                icon={Layers}
                color="text-accent"
              />
              <PerfStatCard
                label="Won"
                value={String(Number(performance.won_combos))}
                icon={Star}
                color="text-success"
              />
              <PerfStatCard
                label="Lost"
                value={String(Number(performance.lost_combos))}
                icon={AlertTriangle}
                color="text-danger"
              />
              <PerfStatCard
                label="Hit Rate"
                value={`${Number(performance.hit_rate).toFixed(1)}%`}
                icon={Target}
                color="text-warning"
              />
              <PerfStatCard
                label="ROI"
                value={`${Number(performance.roi) >= 0 ? '+' : ''}${Number(performance.roi).toFixed(1)}%`}
                icon={TrendingUp}
                color={Number(performance.roi) >= 0 ? 'text-success' : 'text-danger'}
              />
              <PerfStatCard
                label="Streak"
                value={`${Number(performance.current_streak) > 0 ? '+' : ''}${String(Number(performance.current_streak))}`}
                icon={Zap}
                color={Number(performance.current_streak) >= 0 ? 'text-success' : 'text-danger'}
              />
            </div>

            {/* CSS bar chart of monthly results */}
            <PerformanceBarChart monthlyResults={performance.monthly_results} />
          </div>
        )}
      </div>
    </div>
  )
}

// ----- Sub-components -----

function ComboSection({
  title,
  description,
  combos,
  colorClass,
  bgClass,
  icon: Icon,
}: {
  title: string
  description: string
  combos: AccumulatorComboRow[]
  colorClass: string
  bgClass: string
  icon: React.ComponentType<{ className?: string }>
}) {
  if (combos.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className={`p-1.5 rounded-lg ${bgClass}`}>
            <Icon className={`w-4 h-4 ${colorClass}`} />
          </span>
          <div>
            <p className={`text-sm font-semibold ${colorClass}`}>{title}</p>
            <p className="text-[10px] text-muted">{description}</p>
          </div>
        </div>
        <p className="text-xs text-muted text-center py-4 border border-border/50 border-dashed rounded-lg">
          No {title.toLowerCase()} combos available today
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`p-1.5 rounded-lg ${bgClass}`}>
          <Icon className={`w-4 h-4 ${colorClass}`} />
        </span>
        <div>
          <p className={`text-sm font-semibold ${colorClass}`}>{title}</p>
          <p className="text-[10px] text-muted">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {combos.map((combo) => {
          const comboPicksList = Array.isArray(combo.picks) ? combo.picks : []
          const totalOdds = Number(combo.total_odds)
          const expectedWinRate = Number(combo.expected_win_rate)
          const ev = Number(combo.expected_value)
          const stakePct = Number(combo.suggested_stake_pct)
          const projectedROI = Number(combo.projected_roi)
          const hitRateNeeded = Number(combo.hit_rate_needed)
          const recoveryLoss = Number(combo.recovery_after_loss)
          const winOnTen = totalOdds * 10

          return (
            <div
              key={String(combo.id)}
              className="bg-background border border-border rounded-lg p-4 hover:border-accent/30 transition-colors"
            >
              {/* Picks list */}
              <div className="mb-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Picks</p>
                <div className="flex flex-wrap gap-1.5">
                  {comboPicksList.length > 0 ? (
                    comboPicksList.map((pickItem, idx) => {
                      const pickObj = pickItem as Record<string, unknown> | null
                      const label = pickObj ? String(pickObj.team || pickObj.name || pickObj.selection || `Pick ${idx + 1}`) : `Pick ${idx + 1}`
                      return (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${bgClass} ${colorClass}`}
                        >
                          {label}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-xs text-muted">No picks data</span>
                  )}
                </div>
              </div>

              {/* Combo stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-3">
                <div>
                  <span className="text-muted">Total Odds</span>
                  <p className="text-foreground font-bold text-sm">{totalOdds.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted">Win Rate</span>
                  <p className="text-foreground font-semibold">{expectedWinRate.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-muted">EV</span>
                  <p className={`font-semibold ${ev >= 0 ? 'text-success' : 'text-danger'}`}>
                    {ev >= 0 ? '+' : ''}{ev.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Stake %</span>
                  <p className="text-foreground font-semibold">{stakePct.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-muted flex items-center gap-0.5">
                    <Calculator className="w-3 h-3" /> Win on 10
                  </span>
                  <p className="text-success font-bold">{winOnTen.toFixed(2)}</p>
                </div>
              </div>

              {/* Season simulation box */}
              <div className="bg-card border border-border/50 rounded-lg p-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Season Simulation</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted">Projected ROI</span>
                    <p className={`font-semibold ${projectedROI >= 0 ? 'text-success' : 'text-danger'}`}>
                      {projectedROI >= 0 ? '+' : ''}{projectedROI.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Hit Rate Needed</span>
                    <p className="text-foreground font-semibold">{hitRateNeeded.toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-muted">Recovery (Loss)</span>
                    <p className="text-foreground font-semibold">{recoveryLoss.toFixed(1)} bets</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PerfStatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-3 text-center">
      <div className={`p-2 rounded-lg bg-card inline-flex mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  )
}

function PerformanceBarChart({ monthlyResults }: { monthlyResults: unknown }) {
  // monthlyResults expected as an array of { month: string, won: number, lost: number } or similar
  const months = Array.isArray(monthlyResults) ? monthlyResults : []

  if (months.length === 0) {
    return (
      <div className="border border-border/50 border-dashed rounded-lg p-4 text-center">
        <p className="text-xs text-muted">Monthly bar chart will appear once results accumulate.</p>
      </div>
    )
  }

  // Find max value for scaling
  const maxVal = months.reduce((max: number, m: unknown) => {
    const obj = m as Record<string, unknown>
    const won = Number(obj.won || 0)
    const lost = Number(obj.lost || 0)
    return Math.max(max, won, lost)
  }, 1)

  return (
    <div>
      <p className="text-[10px] text-muted uppercase tracking-wider mb-3">Monthly Performance</p>
      <div className="flex items-end gap-2 h-32">
        {months.map((m: unknown, idx: number) => {
          const obj = m as Record<string, unknown>
          const monthLabel = String(obj.month || obj.label || `M${idx + 1}`)
          const won = Number(obj.won || 0)
          const lost = Number(obj.lost || 0)
          const wonHeight = maxVal > 0 ? (won / maxVal) * 100 : 0
          const lostHeight = maxVal > 0 ? (lost / maxVal) * 100 : 0

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                <div
                  className="bg-success rounded-t w-3 min-h-[2px]"
                  style={{ height: `${wonHeight}%` }}
                  title={`Won: ${won}`}
                />
                <div
                  className="bg-danger rounded-t w-3 min-h-[2px]"
                  style={{ height: `${lostHeight}%` }}
                  title={`Lost: ${lost}`}
                />
              </div>
              <span className="text-[9px] text-muted">{monthLabel}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-success" />
          <span className="text-[10px] text-muted">Won</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-danger" />
          <span className="text-[10px] text-muted">Lost</span>
        </div>
      </div>
    </div>
  )
}
