import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL, API_RATE_LIMITS } from '@/lib/utils/constants'
import type {
  FootballAPIResponse,
  FootballFixture,
  FootballStanding,
  FootballInjury,
  FootballH2H,
} from '@/lib/types/api'

// Auto-detect: RapidAPI keys contain 'msh', direct API-SPORTS keys don't
const isRapidAPI = (key: string) => key.includes('msh')
const RAPIDAPI_URL = 'https://api-football-v1.p.rapidapi.com/v3'
const DIRECT_URL = 'https://v3.football.api-sports.io'

async function footballFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<FootballAPIResponse<T>> {
  const apiKey = process.env.FOOTBALL_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_API_KEY not configured')

  const useRapidAPI = isRapidAPI(apiKey)
  const baseUrl = useRapidAPI ? RAPIDAPI_URL : DIRECT_URL

  const url = new URL(`${baseUrl}${endpoint}`)
  Object.entries(params).forEach(([key, val]) =>
    url.searchParams.set(key, String(val))
  )

  const headers: Record<string, string> = useRapidAPI
    ? {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      }
    : {
        'x-apisports-key': apiKey,
      }

  const res = await fetch(url.toString(), {
    headers,
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Football API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`Football API error: ${JSON.stringify(data.errors)}`)
  }

  return data as FootballAPIResponse<T>
}

// ==========================================
// Fixtures
// ==========================================

export async function getFixtures(
  leagueId: number,
  season: number,
  options: { from?: string; to?: string; status?: string; next?: number } = {}
): Promise<FootballFixture[]> {
  const cacheKey = `fixtures:${leagueId}:${season}:${JSON.stringify(options)}`

  return getCached(
    cacheKey,
    async () => {
      const params: Record<string, string | number> = {
        league: leagueId,
        season,
      }
      if (options.from) params.from = options.from
      if (options.to) params.to = options.to
      if (options.status) params.status = options.status
      if (options.next) params.next = options.next

      const data = await footballFetch<FootballFixture>('/fixtures', params)
      return data.response
    },
    CACHE_TTL.FIXTURES
  )
}

export async function getFixtureById(fixtureId: number): Promise<FootballFixture | null> {
  const cacheKey = `fixture:${fixtureId}`

  return getCached(
    cacheKey,
    async () => {
      const data = await footballFetch<FootballFixture>('/fixtures', { id: fixtureId })
      return data.response[0] || null
    },
    CACHE_TTL.FIXTURES
  )
}

export async function getLiveFixtures(leagueId?: number): Promise<FootballFixture[]> {
  const params: Record<string, string | number> = { live: 'all' }
  if (leagueId) params.league = leagueId

  const data = await footballFetch<FootballFixture>('/fixtures', params)
  return data.response
}

// ==========================================
// Standings
// ==========================================

export async function getStandings(
  leagueId: number,
  season: number
): Promise<FootballStanding[]> {
  const cacheKey = `standings:${leagueId}:${season}`

  return getCached(
    cacheKey,
    async () => {
      const data = await footballFetch<FootballStanding>('/standings', {
        league: leagueId,
        season,
      })
      return data.response
    },
    CACHE_TTL.STANDINGS
  )
}

// ==========================================
// Injuries
// ==========================================

export async function getInjuries(
  leagueId: number,
  season: number
): Promise<FootballInjury[]> {
  const cacheKey = `injuries:${leagueId}:${season}`

  return getCached(
    cacheKey,
    async () => {
      const data = await footballFetch<FootballInjury>('/injuries', {
        league: leagueId,
        season,
      })
      return data.response
    },
    CACHE_TTL.INJURIES
  )
}

export async function getInjuriesByFixture(fixtureId: number): Promise<FootballInjury[]> {
  const data = await footballFetch<FootballInjury>('/injuries', { fixture: fixtureId })
  return data.response
}

// ==========================================
// Head to Head
// ==========================================

export async function getH2H(
  teamAApiId: number,
  teamBApiId: number,
  last: number = 10
): Promise<FootballH2H[]> {
  const cacheKey = `h2h:${teamAApiId}:${teamBApiId}:${last}`

  return getCached(
    cacheKey,
    async () => {
      const data = await footballFetch<FootballH2H>('/fixtures/headtohead', {
        h2h: `${teamAApiId}-${teamBApiId}`,
        last,
      })
      return data.response
    },
    CACHE_TTL.FIXTURES
  )
}

// ==========================================
// Match Events (live)
// ==========================================

export async function getFixtureEvents(fixtureId: number) {
  const data = await footballFetch<FootballFixture>('/fixtures', {
    id: fixtureId,
  })
  return data.response[0]?.events || []
}

// ==========================================
// Lineups
// ==========================================

export async function getLineups(fixtureId: number) {
  const data = await footballFetch<{ team: { id: number; name: string }; formation: string; startXI: unknown[]; substitutes: unknown[] }>(
    '/fixtures/lineups',
    { fixture: fixtureId }
  )
  return data.response
}

// ==========================================
// Match Statistics
// ==========================================

export async function getFixtureStatistics(fixtureId: number) {
  const data = await footballFetch<{ team: { id: number; name: string }; statistics: Array<{ type: string; value: number | string | null }> }>(
    '/fixtures/statistics',
    { fixture: fixtureId }
  )
  return data.response
}

// ==========================================
// Helpers
// ==========================================

export function getCurrentSeason(): number {
  const now = new Date()
  // European season starts in Aug, so if before Aug use previous year
  const calculated = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  // Free API-Football plans only support up to season 2024
  // Cap to 2024 to avoid "Free plans do not have access" errors
  const maxSeason = parseInt(process.env.MAX_FOOTBALL_SEASON || '2024', 10)
  return Math.min(calculated, maxSeason)
}

export function getDateRange(daysAhead: number = 7): { from: string; to: string } {
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + daysAhead)

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}
