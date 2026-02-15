'use client'

import { Bell, Menu, Search } from 'lucide-react'

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
      {/* Mobile menu button */}
      <button className="md:hidden p-2 text-muted hover:text-foreground">
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search matches, teams..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Odds alerts */}
        <button className="relative p-2 text-muted hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* Bankroll quick view */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-border">
          <span className="text-xs text-muted">Bankroll</span>
          <span className="text-sm font-semibold text-success">--</span>
        </div>
      </div>
    </header>
  )
}
