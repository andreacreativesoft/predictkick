import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'
import type { GNewsResponse, GNewsArticle } from '@/lib/types/api'

const BASE_URL = 'https://gnews.io/api/v4'

async function newsFetch(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<GNewsResponse> {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) throw new Error('NEWS_API_KEY not configured')

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('apikey', apiKey)
  url.searchParams.set('lang', 'en')
  Object.entries(params).forEach(([key, val]) =>
    url.searchParams.set(key, String(val))
  )

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })

  if (!res.ok) {
    throw new Error(`News API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<GNewsResponse>
}

// ==========================================
// Search Team News
// ==========================================

export async function searchTeamNews(
  teamName: string,
  options: { max?: number; from?: string } = {}
): Promise<GNewsArticle[]> {
  const cacheKey = `news:team:${teamName}:${options.max || 10}`

  return getCached(
    cacheKey,
    async () => {
      const query = `${teamName} (injury OR suspended OR lineup OR transfer OR manager OR controversy)`
      const params: Record<string, string | number> = {
        q: query,
        max: options.max || 10,
        sortby: 'publishedAt',
      }
      if (options.from) params.from = options.from

      const data = await newsFetch('/search', params)
      return data.articles
    },
    CACHE_TTL.NEWS
  )
}

// ==========================================
// Search Match-Specific News
// ==========================================

export async function searchMatchNews(
  homeTeam: string,
  awayTeam: string,
  options: { max?: number } = {}
): Promise<GNewsArticle[]> {
  const cacheKey = `news:match:${homeTeam}:${awayTeam}`

  return getCached(
    cacheKey,
    async () => {
      const query = `"${homeTeam}" OR "${awayTeam}" (preview OR prediction OR injury OR lineup)`
      const params: Record<string, string | number> = {
        q: query,
        max: options.max || 10,
        sortby: 'publishedAt',
      }

      const data = await newsFetch('/search', params)
      return data.articles
    },
    CACHE_TTL.NEWS
  )
}

// ==========================================
// Categorize News
// ==========================================

export interface CategorizedNews {
  injuries: GNewsArticle[]
  transfers: GNewsArticle[]
  tactics: GNewsArticle[]
  controversy: GNewsArticle[]
  general: GNewsArticle[]
}

export function categorizeNews(articles: GNewsArticle[]): CategorizedNews {
  const result: CategorizedNews = {
    injuries: [],
    transfers: [],
    tactics: [],
    controversy: [],
    general: [],
  }

  for (const article of articles) {
    const text = `${article.title} ${article.description}`.toLowerCase()

    if (text.match(/injur|hurt|sideline|hamstring|knee|ankle|muscle|miss|doubt|fitness/)) {
      result.injuries.push(article)
    } else if (text.match(/transfer|sign|deal|loan|fee|release|contract|move/)) {
      result.transfers.push(article)
    } else if (text.match(/tactic|formation|lineup|strategy|system|rotation/)) {
      result.tactics.push(article)
    } else if (text.match(/scandal|controversy|ban|suspend|fine|protest|sack|fire|dismiss/)) {
      result.controversy.push(article)
    } else {
      result.general.push(article)
    }
  }

  return result
}
