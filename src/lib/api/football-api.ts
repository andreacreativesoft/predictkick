import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'
import type {
  FootballAPIResponse,
  FootballFixture,
  FootballStanding,
  FootballInjury,
  FootballH2H,
} from '@/lib/types/api'

// ==========================================
// Provider Selection
// ==========================================

type Provider = 'football-data' | 'api-football'

function getProvider(): Provider {
  const env = process.env.FOOTBALL_DATA_PROVIDER || 'football-data'
  if (env === 'api-football') return 'api-football'
  return 'football-data'
}

// ==========================================
// League Code Mapping
// ==========================================

// Map old API-Football numeric league IDs to football-data.org string codes
const LEAGUE_ID_TO_FD_CODE: Record<number, string> = {
  39: 'PL',   // Premier League
  140: 'PD',  // La Liga
  135: 'SA',  // Serie A
  78: 'BL1',  // Bundesliga
  61: 'FL1',  // Ligue 1
  2: 'CL',    // Champions League
  3: 'EC',    // Europa League (paid tier on football-data.org)
}

// Reverse map: football-data.org code -> API-Football numeric ID
const FD_CODE_TO_LEAGUE_ID: Record<string, number> = {
  PL: 39,
  PD: 140,
  SA: 135,
  BL1: 78,
  FL1: 61,
  CL: 2,
  EC: 3,
}

// Europa League (EC) requires paid tier on football-data.org
const FD_FREE_TIER_CODES = new Set(['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL'])

// ==========================================
// Rate Limiter for football-data.org (10 req/min)
// ==========================================

let fdLastRequestTime = 0
// 10 req/min limit: within a single serverless function invocation (max 60s),
// we'll make at most ~6 API calls. 1s gap is safe for burst use.
// For sustained use, Vercel cron runs are spaced apart (daily).
const FD_MIN_INTERVAL_MS = 1000

async function fdRateLimitDelay(): Promise<void> {
  const now = Date.now()
  const elapsed = now - fdLastRequestTime
  if (elapsed < FD_MIN_INTERVAL_MS) {
    const wait = FD_MIN_INTERVAL_MS - elapsed
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  fdLastRequestTime = Date.now()
}

// ==========================================
// football-data.org v4 Fetch
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function footballDataFetch<T = any>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY not configured')

  await fdRateLimitDelay()

  const url = new URL(`https://api.football-data.org/v4${endpoint}`)
  Object.entries(params).forEach(([key, val]) =>
    url.searchParams.set(key, String(val))
  )

  const res = await fetch(url.toString(), {
    headers: { 'X-Auth-Token': apiKey },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `football-data.org API error: ${res.status} ${res.statusText} — ${body}`
    )
  }

  return res.json()
}

// ==========================================
// Legacy API-Football Fetch (fallback)
// ==========================================

const isRapidAPI = (key: string) => key.includes('msh')
const RAPIDAPI_URL = 'https://api-football-v1.p.rapidapi.com/v3'
const DIRECT_URL = 'https://v3.football.api-sports.io'

async function legacyFootballFetch<T>(
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
// football-data.org Response Types (internal)
// ==========================================

interface FDMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  stage: string
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
  score: {
    winner: string | null
    duration: string
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  referees: Array<{ id: number; name: string; type: string; nationality: string }>
  competition: { id: number; name: string; code: string }
  area: { id: number; name: string }
}

interface FDStandingEntry {
  position: number
  team: { id: number; name: string; shortName: string; tla: string; crest: string }
  playedGames: number
  form: string | null
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

interface FDStandingsGroup {
  stage: string
  type: string
  group?: string
  table: FDStandingEntry[]
}

interface FDH2HAggregates {
  numberOfMatches: number
  totalGoals: number
  homeTeam: { id: number; name: string; wins: number; draws: number; losses: number }
  awayTeam: { id: number; name: string; wins: number; draws: number; losses: number }
}

// ==========================================
// Translators: football-data.org -> existing shapes
// ==========================================

/**
 * Map football-data.org match status to API-Football status codes
 */
function mapFDStatus(fdStatus: string): { long: string; short: string; elapsed: number | null } {
  const statusMap: Record<string, { long: string; short: string }> = {
    SCHEDULED: { long: 'Not Started', short: 'NS' },
    TIMED: { long: 'Not Started', short: 'NS' },
    IN_PLAY: { long: 'First Half', short: '1H' },
    PAUSED: { long: 'Halftime', short: 'HT' },
    FINISHED: { long: 'Match Finished', short: 'FT' },
    POSTPONED: { long: 'Match Postponed', short: 'PST' },
    CANCELLED: { long: 'Match Cancelled', short: 'CANC' },
    SUSPENDED: { long: 'Match Suspended', short: 'SUSP' },
    AWARDED: { long: 'Match Awarded', short: 'AWD' },
  }

  const mapped = statusMap[fdStatus] || { long: fdStatus, short: fdStatus }
  const elapsed = fdStatus === 'IN_PLAY' ? 45 : fdStatus === 'PAUSED' ? 45 : null

  return { ...mapped, elapsed }
}

/**
 * Convert an FDMatch into the FootballFixture shape used by all downstream consumers.
 */
function translateFDMatchToFixture(match: FDMatch): FootballFixture {
  const leagueId = FD_CODE_TO_LEAGUE_ID[match.competition.code] || match.competition.id
  const timestamp = Math.floor(new Date(match.utcDate).getTime() / 1000)
  const status = mapFDStatus(match.status)
  const referee = match.referees?.find((r) => r.type === 'REFEREE')

  const homeWinner =
    match.score.winner === 'HOME_TEAM' ? true :
    match.score.winner === 'AWAY_TEAM' ? false :
    match.score.winner === 'DRAW' ? null : null

  const awayWinner =
    match.score.winner === 'AWAY_TEAM' ? true :
    match.score.winner === 'HOME_TEAM' ? false :
    match.score.winner === 'DRAW' ? null : null

  return {
    fixture: {
      id: match.id,
      referee: referee?.name || null,
      timezone: 'UTC',
      date: match.utcDate,
      timestamp,
      periods: { first: null, second: null },
      venue: { id: 0, name: '', city: '' },
      status,
    },
    league: {
      id: leagueId,
      name: match.competition.name,
      country: match.area.name,
      logo: '',
      flag: '',
      season: getCurrentSeason(),
      round: match.matchday ? `Regular Season - ${match.matchday}` : match.stage,
    },
    teams: {
      home: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        logo: match.homeTeam.crest || '',
        winner: homeWinner,
      },
      away: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        logo: match.awayTeam.crest || '',
        winner: awayWinner,
      },
    },
    goals: {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away,
    },
    score: {
      halftime: {
        home: match.score.halfTime.home,
        away: match.score.halfTime.away,
      },
      fulltime: {
        home: match.score.fullTime.home,
        away: match.score.fullTime.away,
      },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  }
}

/**
 * Convert football-data.org standings response into the FootballStanding shape.
 */
function translateFDStandings(
  fdStandings: FDStandingsGroup[],
  leagueId: number,
  competitionName: string,
  areaName: string,
  season: number
): FootballStanding[] {
  // Group the standings by group/stage — API-Football wraps everything in a single
  // league object with a nested array of arrays (one sub-array per group).
  const totalGroups = fdStandings.filter((sg) => sg.type === 'TOTAL')

  // If no TOTAL type found, use all groups
  const groups = totalGroups.length > 0 ? totalGroups : fdStandings

  const standingsArrays = groups.map((group) =>
    group.table.map((entry) => ({
      rank: entry.position,
      team: {
        id: entry.team.id,
        name: entry.team.name,
        logo: entry.team.crest || '',
      },
      points: entry.points,
      goalsDiff: entry.goalDifference,
      group: group.group || group.stage || 'REGULAR_SEASON',
      form: entry.form ? entry.form.replace(/,/g, '') : '',
      status: '',
      description: null as string | null,
      all: {
        played: entry.playedGames,
        win: entry.won,
        draw: entry.draw,
        lose: entry.lost,
        goals: { for: entry.goalsFor, against: entry.goalsAgainst },
      },
      home: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
      away: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
      update: new Date().toISOString(),
    }))
  )

  // Also try to populate home/away from the HOME and AWAY types if available
  const homeGroup = fdStandings.find((sg) => sg.type === 'HOME')
  const awayGroup = fdStandings.find((sg) => sg.type === 'AWAY')

  if (homeGroup && awayGroup) {
    for (const standings of standingsArrays) {
      for (const entry of standings) {
        const homeEntry = homeGroup.table.find((h) => h.team.id === entry.team.id)
        const awayEntry = awayGroup.table.find((a) => a.team.id === entry.team.id)
        if (homeEntry) {
          entry.home = {
            played: homeEntry.playedGames,
            win: homeEntry.won,
            draw: homeEntry.draw,
            lose: homeEntry.lost,
            goals: { for: homeEntry.goalsFor, against: homeEntry.goalsAgainst },
          }
        }
        if (awayEntry) {
          entry.away = {
            played: awayEntry.playedGames,
            win: awayEntry.won,
            draw: awayEntry.draw,
            lose: awayEntry.lost,
            goals: { for: awayEntry.goalsFor, against: awayEntry.goalsAgainst },
          }
        }
      }
    }
  }

  return [
    {
      league: {
        id: leagueId,
        name: competitionName,
        country: areaName,
        logo: '',
        flag: '',
        season,
        standings: standingsArrays,
      },
    },
  ]
}

/**
 * Convert an FDMatch into the FootballH2H shape used downstream.
 */
function translateFDMatchToH2H(match: FDMatch): FootballH2H {
  const fixture = translateFDMatchToFixture(match)
  return {
    fixture: fixture.fixture,
    league: fixture.league,
    teams: fixture.teams,
    goals: fixture.goals,
    score: fixture.score,
  }
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
      if (getProvider() === 'football-data') {
        return getFixturesViaFD(leagueId, season, options)
      }
      return getFixturesViaLegacy(leagueId, season, options)
    },
    CACHE_TTL.FIXTURES
  )
}

async function getFixturesViaFD(
  leagueId: number,
  season: number,
  options: { from?: string; to?: string; status?: string; next?: number }
): Promise<FootballFixture[]> {
  const code = LEAGUE_ID_TO_FD_CODE[leagueId]
  if (!code) {
    console.warn(`[football-data] No code mapping for league ${leagueId}, falling back to legacy`)
    return getFixturesViaLegacy(leagueId, season, options)
  }

  // Europa League requires paid tier — fall back to legacy
  if (!FD_FREE_TIER_CODES.has(code)) {
    console.warn(`[football-data] League ${code} not on free tier, falling back to legacy`)
    return getFixturesViaLegacy(leagueId, season, options)
  }

  const params: Record<string, string | number> = {
    season,
  }

  if (options.from) params.dateFrom = options.from
  if (options.to) params.dateTo = options.to

  // Map API-Football status codes to football-data.org status values
  if (options.status) {
    const statusMap: Record<string, string> = {
      NS: 'SCHEDULED',
      FT: 'FINISHED',
      '1H': 'IN_PLAY',
      HT: 'PAUSED',
      '2H': 'IN_PLAY',
      PST: 'POSTPONED',
      CANC: 'CANCELLED',
    }
    const mappedStatuses = options.status
      .split('-')
      .map((s) => statusMap[s.trim()] || s.trim())
      .join(',')
    params.status = mappedStatuses
  }

  const data = await footballDataFetch<{ matches: FDMatch[] }>(
    `/competitions/${code}/matches`,
    params
  )

  let matches = data.matches || []

  // Handle 'next' option by limiting results
  if (options.next && options.next > 0) {
    const now = new Date()
    matches = matches
      .filter((m) => new Date(m.utcDate) >= now)
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
      .slice(0, options.next)
  }

  return matches.map(translateFDMatchToFixture)
}

async function getFixturesViaLegacy(
  leagueId: number,
  season: number,
  options: { from?: string; to?: string; status?: string; next?: number }
): Promise<FootballFixture[]> {
  const params: Record<string, string | number> = {
    league: leagueId,
    season,
  }
  if (options.from) params.from = options.from
  if (options.to) params.to = options.to
  if (options.status) params.status = options.status
  if (options.next) params.next = options.next

  const data = await legacyFootballFetch<FootballFixture>('/fixtures', params)
  return data.response
}

// ==========================================
// Fixture by ID
// ==========================================

export async function getFixtureById(fixtureId: number): Promise<FootballFixture | null> {
  const cacheKey = `fixture:${fixtureId}`

  return getCached(
    cacheKey,
    async () => {
      if (getProvider() === 'football-data') {
        return getFixtureByIdViaFD(fixtureId)
      }
      return getFixtureByIdViaLegacy(fixtureId)
    },
    CACHE_TTL.FIXTURES
  )
}

async function getFixtureByIdViaFD(fixtureId: number): Promise<FootballFixture | null> {
  try {
    const data = await footballDataFetch<FDMatch>(`/matches/${fixtureId}`)
    // The single match endpoint returns the match object directly (not wrapped in .matches)
    if (!data || !data.id) return null
    return translateFDMatchToFixture(data)
  } catch {
    console.warn(`[football-data] Failed to fetch match ${fixtureId}, falling back to legacy`)
    return getFixtureByIdViaLegacy(fixtureId)
  }
}

async function getFixtureByIdViaLegacy(fixtureId: number): Promise<FootballFixture | null> {
  const data = await legacyFootballFetch<FootballFixture>('/fixtures', { id: fixtureId })
  return data.response[0] || null
}

// ==========================================
// Live Fixtures
// ==========================================

export async function getLiveFixtures(leagueId?: number): Promise<FootballFixture[]> {
  if (getProvider() === 'football-data') {
    return getLiveFixturesViaFD(leagueId)
  }
  return getLiveFixturesViaLegacy(leagueId)
}

async function getLiveFixturesViaFD(leagueId?: number): Promise<FootballFixture[]> {
  try {
    const params: Record<string, string | number> = {
      status: 'IN_PLAY,PAUSED',
    }

    if (leagueId) {
      const code = LEAGUE_ID_TO_FD_CODE[leagueId]
      if (code) {
        params.competitions = code
      }
    }

    const data = await footballDataFetch<{ matches: FDMatch[] }>('/matches', params)
    return (data.matches || []).map(translateFDMatchToFixture)
  } catch {
    console.warn('[football-data] Live fixtures failed, falling back to legacy')
    return getLiveFixturesViaLegacy(leagueId)
  }
}

async function getLiveFixturesViaLegacy(leagueId?: number): Promise<FootballFixture[]> {
  const params: Record<string, string | number> = { live: 'all' }
  if (leagueId) params.league = leagueId

  const data = await legacyFootballFetch<FootballFixture>('/fixtures', params)
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
      if (getProvider() === 'football-data') {
        return getStandingsViaFD(leagueId, season)
      }
      return getStandingsViaLegacy(leagueId, season)
    },
    CACHE_TTL.STANDINGS
  )
}

async function getStandingsViaFD(
  leagueId: number,
  season: number
): Promise<FootballStanding[]> {
  const code = LEAGUE_ID_TO_FD_CODE[leagueId]
  if (!code) {
    console.warn(`[football-data] No code mapping for league ${leagueId}, falling back to legacy`)
    return getStandingsViaLegacy(leagueId, season)
  }

  if (!FD_FREE_TIER_CODES.has(code)) {
    console.warn(`[football-data] League ${code} not on free tier, falling back to legacy`)
    return getStandingsViaLegacy(leagueId, season)
  }

  const params: Record<string, string | number> = { season }

  const data = await footballDataFetch<{
    competition: { id: number; name: string; code: string }
    area: { id: number; name: string }
    season: { id: number; startDate: string; endDate: string }
    standings: FDStandingsGroup[]
  }>(`/competitions/${code}/standings`, params)

  return translateFDStandings(
    data.standings || [],
    leagueId,
    data.competition?.name || code,
    data.area?.name || '',
    season
  )
}

async function getStandingsViaLegacy(
  leagueId: number,
  season: number
): Promise<FootballStanding[]> {
  const data = await legacyFootballFetch<FootballStanding>('/standings', {
    league: leagueId,
    season,
  })
  return data.response
}

// ==========================================
// Injuries
// ==========================================
// football-data.org free tier does NOT have an injuries endpoint.
// Strategy: fall back to API-Football if FOOTBALL_API_KEY is set,
// otherwise return an empty array.

export async function getInjuries(
  leagueId: number,
  season: number
): Promise<FootballInjury[]> {
  const cacheKey = `injuries:${leagueId}:${season}`

  return getCached(
    cacheKey,
    async () => {
      // Always use legacy API-Football for injuries if key is available
      if (process.env.FOOTBALL_API_KEY) {
        try {
          const data = await legacyFootballFetch<FootballInjury>('/injuries', {
            league: leagueId,
            season,
          })
          return data.response
        } catch (err) {
          console.warn('[football-api] Injuries fetch failed, returning empty:', err)
          return []
        }
      }
      // No API-Football key — injuries not available on football-data.org free tier
      console.warn('[football-data] Injuries not available on free tier, returning empty array')
      return []
    },
    CACHE_TTL.INJURIES
  )
}

export async function getInjuriesByFixture(fixtureId: number): Promise<FootballInjury[]> {
  // Only available via legacy API-Football
  if (process.env.FOOTBALL_API_KEY) {
    try {
      const data = await legacyFootballFetch<FootballInjury>('/injuries', { fixture: fixtureId })
      return data.response
    } catch (err) {
      console.warn('[football-api] Injuries by fixture failed:', err)
      return []
    }
  }
  return []
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
      if (getProvider() === 'football-data') {
        return getH2HViaFD(teamAApiId, teamBApiId, last)
      }
      return getH2HViaLegacy(teamAApiId, teamBApiId, last)
    },
    CACHE_TTL.FIXTURES
  )
}

async function getH2HViaFD(
  teamAApiId: number,
  teamBApiId: number,
  last: number
): Promise<FootballH2H[]> {
  try {
    // football-data.org H2H requires a match ID, not team IDs.
    // Strategy: find a recent match between the two teams, then use the H2H endpoint.
    // First, get recent matches for teamA and look for matches involving teamB.
    const data = await footballDataFetch<{
      matches: FDMatch[]
    }>(`/teams/${teamAApiId}/matches`, {
      status: 'FINISHED',
      limit: 100,
    })

    const h2hMatches = (data.matches || [])
      .filter(
        (m) =>
          (m.homeTeam.id === teamAApiId && m.awayTeam.id === teamBApiId) ||
          (m.homeTeam.id === teamBApiId && m.awayTeam.id === teamAApiId)
      )
      .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      .slice(0, last)

    if (h2hMatches.length === 0) {
      // If we found a match between the two, try the dedicated H2H endpoint
      // Otherwise return empty
      return []
    }

    // If we have a recent match, try the dedicated /matches/{id}/head2head endpoint
    // for richer aggregate data. But the returned shape is matches, which we can use.
    try {
      const h2hData = await footballDataFetch<{
        aggregates: FDH2HAggregates
        matches: FDMatch[]
      }>(`/matches/${h2hMatches[0].id}/head2head`, { limit: last })

      return (h2hData.matches || []).map(translateFDMatchToH2H)
    } catch {
      // Fallback: just use the filtered matches we already have
      return h2hMatches.map(translateFDMatchToH2H)
    }
  } catch {
    console.warn('[football-data] H2H failed, falling back to legacy')
    return getH2HViaLegacy(teamAApiId, teamBApiId, last)
  }
}

async function getH2HViaLegacy(
  teamAApiId: number,
  teamBApiId: number,
  last: number
): Promise<FootballH2H[]> {
  const data = await legacyFootballFetch<FootballH2H>('/fixtures/headtohead', {
    h2h: `${teamAApiId}-${teamBApiId}`,
    last,
  })
  return data.response
}

// ==========================================
// Match Events (live)
// ==========================================

export async function getFixtureEvents(fixtureId: number) {
  if (getProvider() === 'football-data') {
    // football-data.org does not provide granular live events on the free tier.
    // Fall back to legacy if available, otherwise return empty.
    if (process.env.FOOTBALL_API_KEY) {
      try {
        const data = await legacyFootballFetch<FootballFixture>('/fixtures', {
          id: fixtureId,
        })
        return data.response[0]?.events || []
      } catch {
        return []
      }
    }
    return []
  }

  const data = await legacyFootballFetch<FootballFixture>('/fixtures', {
    id: fixtureId,
  })
  return data.response[0]?.events || []
}

// ==========================================
// Lineups
// ==========================================

export async function getLineups(fixtureId: number) {
  // Lineups are not available on football-data.org free tier.
  // Always use legacy API-Football.
  if (process.env.FOOTBALL_API_KEY) {
    try {
      const data = await legacyFootballFetch<{
        team: { id: number; name: string }
        formation: string
        startXI: unknown[]
        substitutes: unknown[]
      }>('/fixtures/lineups', { fixture: fixtureId })
      return data.response
    } catch {
      return []
    }
  }
  return []
}

// ==========================================
// Match Statistics
// ==========================================

export async function getFixtureStatistics(fixtureId: number) {
  // Match statistics are not available on football-data.org free tier.
  // Always use legacy API-Football.
  if (process.env.FOOTBALL_API_KEY) {
    try {
      const data = await legacyFootballFetch<{
        team: { id: number; name: string }
        statistics: Array<{ type: string; value: number | string | null }>
      }>('/fixtures/statistics', { fixture: fixtureId })
      return data.response
    } catch {
      return []
    }
  }
  return []
}

// ==========================================
// Helpers
// ==========================================

export function getCurrentSeason(): number {
  const now = new Date()
  // European season starts in Aug, so if before Aug use previous year
  // football-data.org uses the start year (e.g., 2025 for 2025/26)
  // No MAX_FOOTBALL_SEASON cap needed — football-data.org has no season restrictions
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
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

// ==========================================
// Exported utilities for provider awareness
// ==========================================

/** Get the football-data.org competition code for a given API-Football league ID */
export function getCompetitionCode(leagueId: number): string | null {
  return LEAGUE_ID_TO_FD_CODE[leagueId] || null
}

/** Check if a league is available on football-data.org free tier */
export function isLeagueOnFreeTier(leagueId: number): boolean {
  const code = LEAGUE_ID_TO_FD_CODE[leagueId]
  return code ? FD_FREE_TIER_CODES.has(code) : false
}

/** Get the current active provider name */
export function getActiveProvider(): Provider {
  return getProvider()
}
