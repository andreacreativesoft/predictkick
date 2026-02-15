import { Trophy, TrendingUp, Wallet, Radio } from 'lucide-react'

const stats = [
  { label: "Today's Matches", value: '--', icon: Trophy, color: 'text-accent' },
  { label: 'Value Bets', value: '--', icon: TrendingUp, color: 'text-success' },
  { label: 'Bankroll', value: '--', icon: Wallet, color: 'text-warning' },
  { label: 'Active Bets', value: '--', icon: Radio, color: 'text-danger' },
]

export default function Dashboard() {
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

      {/* Match cards placeholder */}
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          No matches loaded yet
        </h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          Set up your environment variables and run the data sync cron jobs to
          start loading fixtures, odds, and generating predictions.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 justify-center text-xs">
          <span className="px-3 py-1 bg-background border border-border rounded-full text-muted">
            Step 1: Add .env.local
          </span>
          <span className="px-3 py-1 bg-background border border-border rounded-full text-muted">
            Step 2: Run migrations
          </span>
          <span className="px-3 py-1 bg-background border border-border rounded-full text-muted">
            Step 3: Sync fixtures
          </span>
        </div>
      </div>
    </div>
  )
}
