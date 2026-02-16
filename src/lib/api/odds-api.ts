import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'
import type { OddsAPIResponse } from '@/lib/types/api'

const BASE_URL = 'https://api.the-odds-api.com/v4'
const SPORT = 'soccer'

async function oddsFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) throw new Error('ODDS_API_KEY not configured')

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('apiKey', apiKey)
  Object.entries(params).forEach(([key, val]) =>
    url.searchParams.set(key, String(val))
  )

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })

  if (!res.ok) {
    throw new Error(`Odds API error: ${res.status} ${res.statusText}`)
  }

  // Track remaining requests from headers
  const remaining = res.headers.get('x-requests-remaining')
  const used = res.headers.get('x-requests-used')
  if (remaining) {
    console.log(`Odds API: ${used} used, ${remaining} remaining this month`)
  }

  return res.json() as Promise<T>
}

// ==========================================
// Available Sports
// ==========================================

export interface OddsSport {
  key: string
  group: string
  title: string
  description: string
  active: boolean
  has_outrights: boolean
}

export async function getSoccerLeagues(): Promise<OddsSport[]> {
  return oddsFetch<OddsSport[]>('/sports', { group: SPORT })
}

// ==========================================
// Odds for Events
// ==========================================

export async function getOddsForLeague(
  sportKey: string,
  options: {
    regions?: string
    markets?: string
    oddsFormat?: string
    bookmakers?: string
  } = {}
): Promise<OddsAPIResponse[]> {
  const cacheKey = `odds:${sportKey}:${JSON.stringify(options)}`

  return getCached(
    cacheKey,
    async () => {
      const params: Record<string, string> = {
        regions: options.regions || 'eu',
        markets: options.markets || 'h2h,spreads,totals',
        oddsFormat: options.oddsFormat || 'decimal',
      }
      if (options.bookmakers) params.bookmakers = options.bookmakers

      return oddsFetch<OddsAPIResponse[]>(
        `/sports/${sportKey}/odds`,
        params
      )
    },
    CACHE_TTL.ODDS
  )
}

export async function getOddsForEvent(
  sportKey: string,
  eventId: string,
  options: {
    regions?: string
    markets?: string
    oddsFormat?: string
  } = {}
): Promise<OddsAPIResponse> {
  const params: Record<string, string> = {
    regions: options.regions || 'eu',
    markets: options.markets || 'h2h,spreads,totals',
    oddsFormat: options.oddsFormat || 'decimal',
  }

  return oddsFetch<OddsAPIResponse>(
    `/sports/${sportKey}/events/${eventId}/odds`,
    params
  )
}

// ==========================================
// Helpers
// ==========================================

// Map league API IDs to Odds API sport keys
export const LEAGUE_TO_SPORT_KEY: Record<number, string> = {
  39: 'soccer_epl',                    // Premier League
  140: 'soccer_spain_la_liga',          // La Liga
  135: 'soccer_italy_serie_a',          // Serie A
  78: 'soccer_germany_bundesliga',      // Bundesliga
  61: 'soccer_france_ligue_one',        // Ligue 1
  2: 'soccer_uefa_champs_league',       // Champions League
  3: 'soccer_uefa_europa_league',       // Europa League
}

export function findBestOdds(events: OddsAPIResponse[]) {
  return events.map((event) => {
    const h2hMarkets = event.bookmakers
      .flatMap((b) => b.markets.filter((m) => m.key === 'h2h').map((m) => ({ bookmaker: b.key, ...m })))

    let bestHome = { odds: 0, bookmaker: '' }
    let bestDraw = { odds: 0, bookmaker: '' }
    let bestAway = { odds: 0, bookmaker: '' }

    for (const market of h2hMarkets) {
      for (const outcome of market.outcomes) {
        if (outcome.name === event.home_team && outcome.price > bestHome.odds) {
          bestHome = { odds: outcome.price, bookmaker: market.bookmaker }
        }
        if (outcome.name === 'Draw' && outcome.price > bestDraw.odds) {
          bestDraw = { odds: outcome.price, bookmaker: market.bookmaker }
        }
        if (outcome.name === event.away_team && outcome.price > bestAway.odds) {
          bestAway = { odds: outcome.price, bookmaker: market.bookmaker }
        }
      }
    }

    return {
      event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      best_home: bestHome,
      best_draw: bestDraw,
      best_away: bestAway,
      bookmaker_count: event.bookmakers.length,
    }
  })
}
