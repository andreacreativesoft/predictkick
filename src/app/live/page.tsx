import { Radio, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LivePage() {
  const supabase = await createClient()

  const { data: liveTracking } = await supabase
    .from('live_tracking')
    .select(`
      *,
      bet:bets!live_tracking_bet_id_fkey(
        market, selection, odds, stake, potential_return,
        fixture:fixtures!bets_fixture_id_fkey(
          home_team:teams!fixtures_home_team_id_fkey(name, short_name),
          away_team:teams!fixtures_away_team_id_fkey(name, short_name),
          match_date
        )
      )
    `)
    .in('match_status', ['1H', '2H', 'HT', 'ET', 'not_started'])
    .order('updated_at', { ascending: false })

  const tracked = liveTracking || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Radio className="w-6 h-6 text-danger animate-pulse" /> Live Tracker
        </h1>
        <p className="text-sm text-muted mt-1">Monitor your active bets in real-time</p>
      </div>

      {tracked.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Radio className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No live bets</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Place bets on upcoming matches to see them tracked here in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tracked.map((track) => {
            const bet = track.bet as unknown as {
              market: string; selection: string; odds: number; stake: number; potential_return: number;
              fixture: {
                home_team: { name: string; short_name: string | null };
                away_team: { name: string; short_name: string | null };
              };
            }

            const pnl = track.unrealized_pnl || 0
            const isProfit = pnl >= 0

            return (
              <div key={track.id} className="bg-card border border-border rounded-xl p-5">
                {/* Match header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      track.match_status === '1H' || track.match_status === '2H' ? 'bg-danger animate-pulse' :
                      track.match_status === 'HT' ? 'bg-warning' : 'bg-muted'
                    }`} />
                    <span className="text-xs text-muted">
                      {track.match_status === '1H' || track.match_status === '2H' ? `${track.match_minute}'` :
                       track.match_status === 'HT' ? 'Half Time' : 'Not Started'}
                    </span>
                  </div>
                  {track.hedge_recommended && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning text-[10px] font-bold rounded">
                      <AlertTriangle className="w-3 h-3" /> HEDGE
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="text-center mb-4">
                  <p className="text-sm text-muted">{bet?.fixture?.home_team?.short_name || bet?.fixture?.home_team?.name} vs {bet?.fixture?.away_team?.short_name || bet?.fixture?.away_team?.name}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {track.current_score_home} - {track.current_score_away}
                  </p>
                </div>

                {/* Bet details */}
                <div className="grid grid-cols-2 gap-3 text-xs border-t border-border pt-3">
                  <div>
                    <span className="text-muted">Your Bet:</span>
                    <span className="text-foreground ml-1 capitalize">{bet?.selection} @ {bet?.odds?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Stake:</span>
                    <span className="text-foreground ml-1">€{bet?.stake?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted">Position:</span>
                    <span className={`ml-1 font-semibold ${isProfit ? 'text-success' : 'text-danger'}`}>
                      {isProfit ? '+' : ''}€{pnl.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">Cashout:</span>
                    <span className="text-foreground ml-1">
                      {track.cashout_available ? `€${track.cashout_value?.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
