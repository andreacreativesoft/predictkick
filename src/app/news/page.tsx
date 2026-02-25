'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Newspaper,
  AlertTriangle,
  ArrowRightLeft,
  ShieldAlert,
  ExternalLink,
  Clock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  Filter,
} from 'lucide-react'

interface NewsItem {
  id: string
  team_id: string | null
  fixture_id: string | null
  factor_type: string
  title: string
  description: string | null
  sentiment: 'positive' | 'negative' | 'neutral'
  impact_score: number
  source: string | null
  source_url: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  team?: { id: string; name: string; short_name: string | null; logo_url: string | null } | null
}

interface CategoryCounts {
  all: number
  injury_news: number
  scandal: number
  transfer_news: number
}

const CATEGORIES = [
  { key: 'all', label: 'All News', icon: Newspaper, color: 'text-accent' },
  { key: 'injury_news', label: 'Injuries', icon: AlertTriangle, color: 'text-danger' },
  { key: 'transfer_news', label: 'Transfers', icon: ArrowRightLeft, color: 'text-accent' },
  { key: 'scandal', label: 'Controversies', icon: ShieldAlert, color: 'text-warning' },
]

function getCategoryMeta(factorType: string) {
  switch (factorType) {
    case 'injury_news':
      return { label: 'Injury', icon: AlertTriangle, bgClass: 'bg-danger/10', textClass: 'text-danger', borderClass: 'border-danger/20' }
    case 'transfer_news':
      return { label: 'Transfer', icon: ArrowRightLeft, bgClass: 'bg-accent/10', textClass: 'text-accent', borderClass: 'border-accent/20' }
    case 'scandal':
      return { label: 'Controversy', icon: ShieldAlert, bgClass: 'bg-warning/10', textClass: 'text-warning', borderClass: 'border-warning/20' }
    default:
      return { label: 'News', icon: Newspaper, bgClass: 'bg-muted/10', textClass: 'text-muted', borderClass: 'border-border' }
  }
}

function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case 'negative':
      return <TrendingDown className="w-3.5 h-3.5 text-danger" />
    case 'positive':
      return <TrendingUp className="w-3.5 h-3.5 text-success" />
    default:
      return <Minus className="w-3.5 h-3.5 text-muted" />
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [counts, setCounts] = useState<CategoryCounts>({ all: 0, injury_news: 0, scandal: 0, transfer_news: 0 })
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNews = useCallback(async (category: string) => {
    try {
      const res = await fetch(`/api/news?category=${category}&limit=50`)
      const data = await res.json()
      setNews(data.news || [])
      setCounts(data.counts || { all: 0, injury_news: 0, scandal: 0, transfer_news: 0 })
    } catch (err) {
      console.error('Failed to fetch news:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchNews(activeCategory)
  }, [activeCategory, fetchNews])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchNews(activeCategory)
  }

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category)
    setLoading(true)
  }

  // Group news by date
  const groupedNews = news.reduce<Record<string, NewsItem[]>>((acc, item) => {
    const date = new Date(item.created_at)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    let label: string
    if (date.toDateString() === today.toDateString()) {
      label = 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday'
    } else {
      label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    }

    if (!acc[label]) acc[label] = []
    acc[label].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News & Intel</h1>
          <p className="text-sm text-muted mt-1">
            Match-affecting news from global and Romanian sources
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-card text-muted text-sm rounded-lg border border-border hover:text-foreground hover:border-accent/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const count = counts[cat.key as keyof CategoryCounts] || 0
          const isActive = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-card text-muted border border-border hover:text-foreground hover:border-accent/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isActive ? 'bg-accent/20 text-accent' : 'bg-background text-muted'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* News Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-5 bg-background rounded" />
                <div className="w-24 h-4 bg-background rounded" />
              </div>
              <div className="w-3/4 h-5 bg-background rounded mb-2" />
              <div className="w-full h-4 bg-background rounded" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Filter className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            No news found
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            {activeCategory === 'all'
              ? 'No match-affecting news has been synced yet. News is collected daily from GNews and Superliga.ro for teams with upcoming fixtures.'
              : `No ${CATEGORIES.find(c => c.key === activeCategory)?.label.toLowerCase()} news available. Try checking "All News" instead.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNews).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                {dateLabel}
              </h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const meta = getCategoryMeta(item.factor_type)
                  const CategoryIcon = meta.icon
                  return (
                    <div
                      key={item.id}
                      className={`bg-card border rounded-xl p-4 hover:border-accent/30 transition-colors ${meta.borderClass}`}
                    >
                      {/* Top row: category badge + team + time */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${meta.bgClass} ${meta.textClass}`}>
                            <CategoryIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                          {item.team && (
                            <span className="text-xs font-medium text-foreground bg-background px-2 py-0.5 rounded border border-border">
                              {item.team.short_name || item.team.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {getSentimentIcon(item.sentiment)}
                            <span className="text-[10px] text-muted capitalize">{item.sentiment}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Clock className="w-3 h-3" />
                          {timeAgo(item.created_at)}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-semibold text-foreground mb-1 leading-snug">
                        {item.title}
                      </h3>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Bottom row: source + impact + link */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {item.source && (
                            <span className="text-[11px] text-muted">
                              Source: <span className="text-foreground font-medium">{item.source}</span>
                            </span>
                          )}
                          <span className="text-[11px] text-muted">
                            Impact: <span className={`font-bold ${
                              item.impact_score >= 0.6 ? 'text-danger' : item.impact_score >= 0.5 ? 'text-warning' : 'text-muted'
                            }`}>{(item.impact_score * 10).toFixed(0)}/10</span>
                          </span>
                        </div>
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors"
                          >
                            Read article
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-card/50 border border-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Newspaper className="w-5 h-5 text-muted mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">How News Affects Predictions</h3>
            <p className="text-xs text-muted leading-relaxed">
              PredictKick automatically collects match-affecting news from GNews (international) and Superliga.ro (Romanian football).
              Injuries, transfers, and controversies are categorized and fed into the prediction engine as contextual factors,
              adjusting probabilities based on sentiment and impact scores. News expires after 7 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
