import { Trophy, TrendingUp, Wallet, Radio, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch today's matches
  const { data: todayFixtures } = await supabase
    .from('fixtures')
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(id, name, short_name),
      away_team:teams!fixtures_away_team_id_fkey(id, name, short_name),
      league:leagues!fixtures_league_id_fkey(id, name),
      predictions(home_win_prob, draw_prob, away_win_prob, predicted_score_home, predicted_score_away, confidence_score, value_bets),
      odds_current(best_home_odds, best_draw_odds, best_away_odds, best_home_bookmaker)
    `)
    .gte('match_date', todayStart.toISOString())
    .lte('match_date', todayEnd.toISOString())
    .order('match_date', { ascending: true })

  // If no matches today, get next upcoming matches
  let upcomingFixtures: typeof todayFixtures = null
  if (!todayFixtures || todayFixtures.length === 0) {
    const { data } = await supabase
      .from('fixtures')
      .select(`
        *,
        home_team:teams!fixtures_home_team_id_fkey(id, name, short_name),
        away_team:teams!fixtures_away_team_id_fkey(id, name, short_name),
        league:leagues!fixtures_league_id_fkey(id, name),
        predictions(home_win_prob, draw_prob, away_win_prob, predicted_score_home, predicted_score_away, confidence_score, value_bets),
        odds_current(best_home_odds, best_draw_odds, best_away_odds, best_home_bookmaker)
      `)
      .eq('status', 'scheduled')
      .gte('match_date', now.toISOString())
      .order('match_date', { ascending: true })
      .limit(15)
    upcomingFixtures = data
  }

  const matches = todayFixtures && todayFixtures.length > 0 ? todayFixtures : (upcomingFixtures || [])
  const isToday = todayFixtures && todayFixtures.length > 0

  // Count value bets across displayed matches
  let valueBetCount = 0
  for (const m of matches) {
    const preds = m.predictions as unknown as Array<Record<string, unknown>> | null
    if (preds?.[0]?.value_bets && Array.isArray(preds[0].value_bets)) {
      valueBetCount += (preds[0].value_bets as unknown[]).length
    }
  }

  // Fetch bankroll
  const { data: bankroll } = await supabase
    .from('bankroll')
    .select('current_amount, roi')
    .eq('status', 'active')
    .limit(1)
    .single()

  // Count active bets
  const { count: activeBets } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const stats = [
    { label: isToday ? "Today's Matches" : 'Upcoming', value: String(matches.length), icon: Trophy, color: 'text-accent' },
    { label: 'Value Bets', value: String(valueBetCount), icon: TrendingUp, color: 'text-success' },
    { label: 'Bankroll', value: bankroll ? `€${Number(bankroll.current_amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '--', icon: Wallet, color: 'text-warning' },
    { label: 'Active Bets', value: String(activeBets || 0), icon: Radio, color: 'text-danger' },
  ]

  // Group matches by date
  const grouped = matches.reduce<Record<string, typeof matches>>((acc, match) => {
    const date = new Date(match.match_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          AI-powered soccer predictions with multi-bookmaker odds
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <div className={`p-2.5 rounded-lg bg-background ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Match cards */}
      {matches.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No upcoming matches
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Run the sync-fixtures cron job to load upcoming fixtures.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, dateMatches]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                {date}
              </h2>
              <div className="space-y-2">
                {dateMatches.map((match) => {
                  const prediction = (match.predictions as unknown as Array<Record<string, unknown>>)?.[0]
                  const odds = (match.odds_current as unknown as Array<Record<string, unknown>>)?.[0]
                  const homeTeam = match.home_team as unknown as { name: string; short_name: string | null }
                  const awayTeam = match.away_team as unknown as { name: string; short_name: string | null }
                  const league = match.league as unknown as { name: string } | null
                  const valueBets = (prediction?.value_bets as unknown[]) || []
                  const hasValue = valueBets.length > 0

                  return (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="block bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted">{league?.name}</span>
                          {hasValue && (
                            <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-bold rounded">
                              VALUE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                          <Clock className="w-3 h-3" />
                          {new Date(match.match_date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Teams */}
                        <div className="flex-1 space-y-1.5">
                          <p className="text-sm font-semibold text-foreground">
                            {homeTeam?.short_name || homeTeam?.name}
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {awayTeam?.short_name || awayTeam?.name}
                          </p>
                        </div>

                        {/* Prediction */}
                        {prediction ? (
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-lg font-bold text-foreground">
                                {String(prediction.predicted_score_home)}-{String(prediction.predicted_score_away)}
                              </div>
                              <div className="text-[10px] text-muted">Predicted</div>
                            </div>
                            <div className="text-center w-10">
                              <div className="text-xs font-bold text-accent">
                                {Number(prediction.confidence_score).toFixed(0)}%
                              </div>
                              <div className="text-[10px] text-muted">Conf</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted">No prediction</span>
                        )}

                        {/* Odds */}
                        {odds && (
                          <div className="hidden sm:flex items-center gap-1.5 ml-3">
                            <OddsBadge label="H" odds={Number(odds.best_home_odds)} />
                            <OddsBadge label="D" odds={Number(odds.best_draw_odds)} />
                            <OddsBadge label="A" odds={Number(odds.best_away_odds)} />
                          </div>
                        )}

                        <ChevronRight className="w-4 h-4 text-muted ml-2" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* View all link */}
          <div className="text-center">
            <Link
              href="/matches"
              className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80"
            >
              View all matches <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function OddsBadge({ label, odds }: { label: string; odds: number }) {
  if (!odds) return null
  return (
    <div className="text-center px-1.5 py-1 bg-background rounded border border-border min-w-[40px]">
      <div className="text-[9px] text-muted">{label}</div>
      <div className="text-xs font-semibold text-foreground">{odds.toFixed(2)}</div>
    </div>
  )
}
