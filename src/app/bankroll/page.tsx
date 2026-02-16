import { Wallet, TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function BankrollPage() {
  const supabase = await createClient()

  const { data: bankroll } = await supabase
    .from('bankroll')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .single()

  const { data: recentBets } = await supabase
    .from('bets')
    .select(`
      *,
      fixture:fixtures!bets_fixture_id_fkey(
        home_team:teams!fixtures_home_team_id_fkey(name, short_name),
        away_team:teams!fixtures_away_team_id_fkey(name, short_name),
        match_date
      )
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  const bets = recentBets || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bankroll</h1>
        <p className="text-sm text-muted mt-1">Track your betting performance and manage your bankroll</p>
      </div>

      {!bankroll ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Wallet className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No bankroll configured</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-4">
            Set up your bankroll to start tracking bets, calculating Kelly stakes, and monitoring performance.
          </p>
          <button className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90">
            Create Bankroll
          </button>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Current Balance"
              value={`€${bankroll.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={Wallet}
              color="text-accent"
            />
            <StatCard
              label="ROI"
              value={`${bankroll.roi >= 0 ? '+' : ''}${bankroll.roi.toFixed(1)}%`}
              icon={bankroll.roi >= 0 ? TrendingUp : TrendingDown}
              color={bankroll.roi >= 0 ? 'text-success' : 'text-danger'}
            />
            <StatCard
              label="Win Rate"
              value={`${bankroll.total_bets > 0 ? ((bankroll.winning_bets / bankroll.total_bets) * 100).toFixed(0) : 0}%`}
              icon={Target}
              color="text-warning"
            />
            <StatCard
              label="Total Bets"
              value={String(bankroll.total_bets)}
              icon={BarChart3}
              color="text-foreground"
            />
          </div>

          {/* Performance summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">P/L Summary</h3>
              <div className="space-y-3">
                <SummaryRow label="Total Staked" value={`€${bankroll.total_staked.toFixed(2)}`} />
                <SummaryRow label="Total Returns" value={`€${bankroll.total_returns.toFixed(2)}`} />
                <SummaryRow
                  label="Net Profit"
                  value={`${bankroll.total_returns - bankroll.total_staked >= 0 ? '+' : ''}€${(bankroll.total_returns - bankroll.total_staked).toFixed(2)}`}
                  highlight={bankroll.total_returns - bankroll.total_staked >= 0}
                />
                <SummaryRow label="Peak Balance" value={`€${(bankroll.peak_amount || bankroll.initial_amount).toFixed(2)}`} />
                <SummaryRow label="Current Drawdown" value={`${(bankroll.drawdown_from_peak || 0).toFixed(1)}%`} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Settings</h3>
              <div className="space-y-3">
                <SummaryRow label="Staking Mode" value={bankroll.staking_mode} />
                <SummaryRow label="Kelly Fraction" value={bankroll.kelly_fraction} />
                <SummaryRow label="Max Single Bet" value={`${bankroll.max_single_bet_pct}%`} />
                <SummaryRow label="Max Daily Exposure" value={`${bankroll.max_daily_exposure_pct}%`} />
                <SummaryRow label="Stop Loss" value={`${bankroll.stop_loss_pct}%`} />
                <SummaryRow label="Current Streak" value={`${bankroll.current_streak > 0 ? '+' : ''}${bankroll.current_streak}`} />
              </div>
            </div>
          </div>

          {/* Recent bets */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Bets</h3>
            {bets.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No bets placed yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="pb-2 pr-4">Match</th>
                      <th className="pb-2 pr-4">Market</th>
                      <th className="pb-2 pr-4">Selection</th>
                      <th className="pb-2 pr-4">Odds</th>
                      <th className="pb-2 pr-4">Stake</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map((bet) => {
                      const fix = bet.fixture as unknown as { home_team: { name: string; short_name: string | null }; away_team: { name: string; short_name: string | null } } | null
                      return (
                        <tr key={bet.id} className="border-b border-border/50">
                          <td className="py-2 pr-4 text-foreground">
                            {fix ? `${fix.home_team.short_name || fix.home_team.name} vs ${fix.away_team.short_name || fix.away_team.name}` : '--'}
                          </td>
                          <td className="py-2 pr-4 text-muted uppercase">{bet.market}</td>
                          <td className="py-2 pr-4 text-foreground capitalize">{bet.selection}</td>
                          <td className="py-2 pr-4 text-foreground">{bet.odds.toFixed(2)}</td>
                          <td className="py-2 pr-4 text-foreground">€{bet.stake.toFixed(2)}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              bet.status === 'won' ? 'bg-success/10 text-success' :
                              bet.status === 'lost' ? 'bg-danger/10 text-danger' :
                              bet.status === 'active' ? 'bg-accent/10 text-accent' :
                              'bg-muted/10 text-muted'
                            }`}>
                              {bet.status.toUpperCase()}
                            </span>
                          </td>
                          <td className={`py-2 font-semibold ${
                            bet.result && bet.result > 0 ? 'text-success' :
                            bet.result && bet.result < 0 ? 'text-danger' :
                            'text-muted'
                          }`}>
                            {bet.result ? `${bet.result > 0 ? '+' : ''}€${bet.result.toFixed(2)}` : '--'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-background ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-semibold ${highlight === true ? 'text-success' : highlight === false ? 'text-danger' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
