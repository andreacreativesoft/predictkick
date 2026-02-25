'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, TrendingUp, TrendingDown, Target, BarChart3, Plus, Minus, ArrowUpRight, ArrowDownRight, Settings, History, RefreshCw } from 'lucide-react'

interface Bankroll {
  id: string
  initial_amount: number
  current_amount: number
  currency: string
  peak_amount: number
  drawdown_from_peak: number
  status: string
  staking_mode: string
  kelly_fraction: string
  flat_stake: number | null
  max_single_bet_pct: number
  max_daily_exposure_pct: number
  stop_loss_pct: number
  total_bets: number
  winning_bets: number
  losing_bets: number
  void_bets: number
  total_staked: number
  total_returns: number
  roi: number
  current_streak: number
  longest_winning_streak: number
  longest_losing_streak: number
}

interface Bet {
  id: string
  market: string
  selection: string
  odds: number
  stake: number
  status: string
  result: number | null
  bookmaker: string
  created_at: string
  fixture: {
    home_team: { name: string; short_name: string | null }
    away_team: { name: string; short_name: string | null }
    match_date: string
  } | null
}

interface Transaction {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export default function BankrollPage() {
  const [bankroll, setBankroll] = useState<Bankroll | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Form states
  const [createAmount, setCreateAmount] = useState('100')
  const [createMode, setCreateMode] = useState('kelly')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  // Settings form
  const [settingsMode, setSettingsMode] = useState('kelly')
  const [settingsKelly, setSettingsKelly] = useState('half')
  const [settingsMaxBet, setSettingsMaxBet] = useState('5')
  const [settingsMaxDaily, setSettingsMaxDaily] = useState('15')
  const [settingsStopLoss, setSettingsStopLoss] = useState('30')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/bankroll/stats')
      const data = await res.json()
      setBankroll(data.bankroll || null)
      setBets(data.recentBets || [])
      setTransactions(data.transactions || [])

      if (data.bankroll) {
        setSettingsMode(data.bankroll.staking_mode)
        setSettingsKelly(data.bankroll.kelly_fraction)
        setSettingsMaxBet(String(data.bankroll.max_single_bet_pct))
        setSettingsMaxDaily(String(data.bankroll.max_daily_exposure_pct))
        setSettingsStopLoss(String(data.bankroll.stop_loss_pct))
      }
    } catch {
      console.error('Failed to fetch bankroll data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/bankroll/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_amount: Number(createAmount),
          staking_mode: createMode,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowCreate(false)
        fetchData()
      } else {
        alert(data.error || 'Failed to create bankroll')
      }
    } catch {
      alert('Error creating bankroll')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransaction = async (type: 'deposit' | 'withdrawal') => {
    const amount = type === 'deposit' ? Number(depositAmount) : Number(withdrawAmount)
    if (!amount || amount <= 0) return

    setActionLoading(true)
    try {
      const res = await fetch('/api/bankroll/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount }),
      })
      const data = await res.json()
      if (data.success) {
        setShowDeposit(false)
        setShowWithdraw(false)
        setDepositAmount('')
        setWithdrawAmount('')
        fetchData()
      } else {
        alert(data.error || `Failed to ${type}`)
      }
    } catch {
      alert(`Error processing ${type}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSettings = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/bankroll/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staking_mode: settingsMode,
          kelly_fraction: settingsKelly,
          max_single_bet_pct: Number(settingsMaxBet),
          max_daily_exposure_pct: Number(settingsMaxDaily),
          stop_loss_pct: Number(settingsStopLoss),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowSettings(false)
        fetchData()
      } else {
        alert(data.error || 'Failed to update settings')
      }
    } catch {
      alert('Error updating settings')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-muted animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bankroll</h1>
          <p className="text-sm text-muted mt-1">Track your betting performance and manage your bankroll</p>
        </div>
        {bankroll && (
          <div className="flex gap-2">
            <button onClick={() => setShowDeposit(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Deposit
            </button>
            <button onClick={() => setShowWithdraw(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors">
              <Minus className="w-3.5 h-3.5" /> Withdraw
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-medium rounded-lg hover:bg-accent/20 transition-colors">
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/5 text-foreground text-xs font-medium rounded-lg hover:bg-foreground/10 transition-colors">
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>
        )}
      </div>

      {/* Modal Overlays */}
      {showDeposit && <Modal title="Deposit Funds" onClose={() => setShowDeposit(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">Amount (EUR)</label>
            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="50.00" min="1" step="0.01"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent" autoFocus />
          </div>
          <button onClick={() => handleTransaction('deposit')} disabled={actionLoading || !depositAmount}
            className="w-full py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 disabled:opacity-50">
            {actionLoading ? 'Processing...' : `Deposit €${depositAmount || '0'}`}
          </button>
        </div>
      </Modal>}

      {showWithdraw && <Modal title="Withdraw Funds" onClose={() => setShowWithdraw(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">Amount (EUR) — Available: €{bankroll?.current_amount.toFixed(2)}</label>
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="25.00" min="1" step="0.01"
              max={bankroll?.current_amount}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent" autoFocus />
          </div>
          <button onClick={() => handleTransaction('withdrawal')} disabled={actionLoading || !withdrawAmount}
            className="w-full py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-danger/90 disabled:opacity-50">
            {actionLoading ? 'Processing...' : `Withdraw €${withdrawAmount || '0'}`}
          </button>
        </div>
      </Modal>}

      {showSettings && <Modal title="Bankroll Settings" onClose={() => setShowSettings(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">Staking Mode</label>
            <select value={settingsMode} onChange={e => setSettingsMode(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              <option value="kelly">Kelly Criterion</option>
              <option value="flat">Flat Stake</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>
          {settingsMode === 'kelly' && (
            <div>
              <label className="text-xs text-muted block mb-1">Kelly Fraction</label>
              <select value={settingsKelly} onChange={e => setSettingsKelly(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                <option value="full">Full Kelly</option>
                <option value="half">Half Kelly (Recommended)</option>
                <option value="quarter">Quarter Kelly</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Max Single Bet %</label>
              <input type="number" value={settingsMaxBet} onChange={e => setSettingsMaxBet(e.target.value)} min="1" max="25"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Max Daily Exposure %</label>
              <input type="number" value={settingsMaxDaily} onChange={e => setSettingsMaxDaily(e.target.value)} min="5" max="50"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Stop Loss %</label>
            <input type="number" value={settingsStopLoss} onChange={e => setSettingsStopLoss(e.target.value)} min="10" max="50"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
          </div>
          <button onClick={handleSettings} disabled={actionLoading}
            className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50">
            {actionLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </Modal>}

      {!bankroll ? (
        /* Create Bankroll */
        !showCreate ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Wallet className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No bankroll configured</h2>
            <p className="text-sm text-muted max-w-md mx-auto mb-4">
              Set up your bankroll to start tracking bets, calculating Kelly stakes, and monitoring performance.
            </p>
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors">
              Create Bankroll
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-foreground mb-4">Create Your Bankroll</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted block mb-1">Initial Amount (EUR)</label>
                <input type="number" value={createAmount} onChange={e => setCreateAmount(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="100.00" min="1" step="0.01" autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Staking Mode</label>
                <select value={createMode} onChange={e => setCreateMode(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                  <option value="kelly">Kelly Criterion (Recommended)</option>
                  <option value="flat">Flat Stake</option>
                  <option value="percentage">Percentage of Bankroll</option>
                </select>
              </div>
              <div className="bg-background rounded-lg p-3 text-xs text-muted space-y-1">
                <p><strong>Kelly Criterion</strong> automatically calculates optimal stake size based on your edge and the odds.</p>
                <p>Default: Half Kelly, Max 5% per bet, 15% daily exposure, 30% stop loss.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-background text-foreground text-sm font-medium rounded-lg hover:bg-background/80 border border-border">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={actionLoading || !createAmount}
                  className="flex-1 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50">
                  {actionLoading ? 'Creating...' : `Start with €${createAmount}`}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Current Balance"
              value={`€${bankroll.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              icon={Wallet} color="text-accent" />
            <StatCard label="ROI"
              value={`${bankroll.roi >= 0 ? '+' : ''}${bankroll.roi.toFixed(1)}%`}
              icon={bankroll.roi >= 0 ? TrendingUp : TrendingDown}
              color={bankroll.roi >= 0 ? 'text-success' : 'text-danger'} />
            <StatCard label="Win Rate"
              value={`${bankroll.total_bets > 0 ? ((bankroll.winning_bets / bankroll.total_bets) * 100).toFixed(0) : 0}%`}
              icon={Target} color="text-warning" />
            <StatCard label="Total Bets"
              value={String(bankroll.total_bets)}
              icon={BarChart3} color="text-foreground" />
          </div>

          {/* Performance summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">P/L Summary</h3>
              <div className="space-y-3">
                <SummaryRow label="Initial Bankroll" value={`€${bankroll.initial_amount.toFixed(2)}`} />
                <SummaryRow label="Total Staked" value={`€${bankroll.total_staked.toFixed(2)}`} />
                <SummaryRow label="Total Returns" value={`€${bankroll.total_returns.toFixed(2)}`} />
                <SummaryRow label="Net Profit"
                  value={`${bankroll.total_returns - bankroll.total_staked >= 0 ? '+' : ''}€${(bankroll.total_returns - bankroll.total_staked).toFixed(2)}`}
                  highlight={bankroll.total_returns - bankroll.total_staked >= 0} />
                <SummaryRow label="Peak Balance" value={`€${(bankroll.peak_amount || bankroll.initial_amount).toFixed(2)}`} />
                <SummaryRow label="Current Drawdown" value={`${(bankroll.drawdown_from_peak || 0).toFixed(1)}%`} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Settings</h3>
                <button onClick={() => setShowSettings(true)} className="text-xs text-accent hover:text-accent/80">
                  Edit
                </button>
              </div>
              <div className="space-y-3">
                <SummaryRow label="Staking Mode" value={bankroll.staking_mode.charAt(0).toUpperCase() + bankroll.staking_mode.slice(1)} />
                <SummaryRow label="Kelly Fraction" value={bankroll.kelly_fraction.charAt(0).toUpperCase() + bankroll.kelly_fraction.slice(1)} />
                <SummaryRow label="Max Single Bet" value={`${bankroll.max_single_bet_pct}%`} />
                <SummaryRow label="Max Daily Exposure" value={`${bankroll.max_daily_exposure_pct}%`} />
                <SummaryRow label="Stop Loss" value={`${bankroll.stop_loss_pct}%`} />
                <SummaryRow label="Current Streak" value={`${bankroll.current_streak > 0 ? '+' : ''}${bankroll.current_streak}`} />
              </div>
            </div>
          </div>

          {/* Transaction History */}
          {showHistory && transactions.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Transaction History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {tx.amount > 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-success" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-danger" />
                      )}
                      <div>
                        <p className="text-xs text-foreground font-medium">{tx.description}</p>
                        <p className="text-[10px] text-muted">
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold ${tx.amount > 0 ? 'text-success' : 'text-danger'}`}>
                        {tx.amount > 0 ? '+' : ''}€{tx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted">Bal: €{tx.balance_after.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent bets */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Recent Bets</h3>
            {bets.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No bets placed yet. Place your first bet from a match page!</p>
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
                      const fix = bet.fixture as Bet['fixture']
                      return (
                        <tr key={bet.id} className="border-b border-border/50 hover:bg-background/30 transition-colors">
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
                            {bet.result != null ? `${bet.result > 0 ? '+' : ''}€${bet.result.toFixed(2)}` : '--'}
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        {children}
      </div>
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
