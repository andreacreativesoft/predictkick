// Romanian bookmaker odds scrapers
// Fetches odds from Superbet, Casa Pariurilor, Las Vegas, and Baum Bet APIs
// Betano is blocked from server-side (403), would need browser session

import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'

// ============================================================================
// Types
// ============================================================================

export type RomanianBookmaker = 'superbet' | 'casa_pariurilor' | 'betano' | 'las_vegas' | 'baum_bet'

export interface RomanianOdds {
  bookmaker: RomanianBookmaker
  matchName: string
  homeTeam: string
  awayTeam: string
  startTime: number // epoch ms
  homeOdds: number | null
  drawOdds: number | null
  awayOdds: number | null
  tournamentId?: string
  tournamentName?: string
  eventId?: string
}

export interface RomanianOddsComparison {
  fixture_id: string
  homeTeam: string
  awayTeam: string
  international: {
    bestHome: number | null
    bestDraw: number | null
    bestAway: number | null
    avgHome: number | null
    avgDraw: number | null
    avgAway: number | null
  }
  romanian: {
    superbet?: { home: number | null; draw: number | null; away: number | null }
    casa_pariurilor?: { home: number | null; draw: number | null; away: number | null }
    betano?: { home: number | null; draw: number | null; away: number | null }
    las_vegas?: { home: number | null; draw: number | null; away: number | null }
    baum_bet?: { home: number | null; draw: number | null; away: number | null }
  }
  valueAlerts: ValueAlert[]
}

export interface ValueAlert {
  bookmaker: string
  selection: 'home' | 'draw' | 'away'
  romanianOdds: number
  internationalAvg: number
  internationalBest: number
  edgePct: number // % higher than international avg
  description: string
}

// ============================================================================
// Superbet API
// ============================================================================

const SUPERBET_BASE = 'https://production-superbet-offer-ro.freetls.fastly.net/v2/ro-RO'

// Superbet tournament IDs for our leagues
const SUPERBET_TOURNAMENTS: Record<number, number> = {
  2: 80794,   // Champions League
  3: 80795,   // Europa League (needs verification)
  39: 80135,  // Premier League (needs verification)
  140: 80227, // La Liga (needs verification)
  135: 80196, // Serie A (needs verification)
  78: 80155,  // Bundesliga (needs verification)
  61: 80164,  // Ligue 1 (needs verification)
}

interface SuperbetEvent {
  eventId: number
  matchName: string
  matchDate: string
  tournamentId: number
  odds?: SuperbetOdd[]
}

interface SuperbetOdd {
  marketId: number
  name: string // "1", "X", "2"
  price: number
  marketName: string
}

export async function fetchSuperbetOdds(
  dateStr?: string // YYYY-MM-DD
): Promise<RomanianOdds[]> {
  const today = dateStr || new Date().toISOString().split('T')[0]
  const cacheKey = `ro:superbet:${today}`

  return getCached(
    cacheKey,
    async () => {
      const start = `${today}+00:00:00`
      const nextDay = new Date(today)
      nextDay.setDate(nextDay.getDate() + 2)
      const end = `${nextDay.toISOString().split('T')[0]}+08:00:00`

      // Note: Superbet API requires raw "+" in date params, NOT URL-encoded %2B
      const url = `${SUPERBET_BASE}/events/by-date?currentStatus=active&offerState=prematch&startDate=${start}&endDate=${end}&sportId=5`

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        console.error(`Superbet API error: ${res.status}`)
        return []
      }

      const json = await res.json()
      const events: SuperbetEvent[] = json.data || []

      const results: RomanianOdds[] = []

      for (const ev of events) {
        const h2hOdds = (ev.odds || []).filter(o => o.marketId === 547) // 547 = "Final" (h2h)
        if (h2hOdds.length < 3) continue // Need 1, X, 2

        const oddsMap: Record<string, number> = {}
        h2hOdds.forEach(o => { oddsMap[o.name] = o.price })

        const [home, away] = ev.matchName.split('·')
        if (!home || !away) continue

        results.push({
          bookmaker: 'superbet',
          matchName: ev.matchName,
          homeTeam: home.trim(),
          awayTeam: away.trim(),
          startTime: new Date(ev.matchDate).getTime(),
          homeOdds: oddsMap['1'] || null,
          drawOdds: oddsMap['X'] || null,
          awayOdds: oddsMap['2'] || null,
          tournamentId: String(ev.tournamentId),
          eventId: String(ev.eventId),
        })
      }

      return results
    },
    CACHE_TTL.ODDS
  )
}

// ============================================================================
// Casa Pariurilor API
// ============================================================================

const CASA_BASE = 'https://api.casapariurilor.ro/offer/structure/api/v1_0'

interface CasaFixture {
  id: string
  name: string
  startDatetime: number
  participants: { name: string; type: 'HOME' | 'AWAY' }[]
  tournamentId: string
  tournamentSeoName: string
}

interface CasaMarket {
  id: string
  fixtureId: string
  name: string
  outcomes: { name: string; longName?: string; odds: number }[]
}

export async function fetchCasaPariurilorOdds(
  timeFilter: string = 'today' // 'today', 'tomorrow', '3h', etc.
): Promise<RomanianOdds[]> {
  const cacheKey = `ro:casa:${timeFilter}`

  return getCached(
    cacheKey,
    async () => {
      const url = `${CASA_BASE}/widget/prematch/most-bet-fixtures?sportId=ufo:sprt:00&limit=100&timeFilter=${timeFilter}`

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        console.error(`Casa Pariurilor API error: ${res.status}`)
        return []
      }

      const json = await res.json()
      const fixtures: CasaFixture[] = json.fixtures || []
      const markets: CasaMarket[] = json.markets || []

      const results: RomanianOdds[] = []

      for (const f of fixtures) {
        const homeParticipant = f.participants.find(p => p.type === 'HOME')
        const awayParticipant = f.participants.find(p => p.type === 'AWAY')
        if (!homeParticipant || !awayParticipant) continue

        // Find the h2h market for this fixture
        const h2hMarket = markets.find(m =>
          m.fixtureId === f.id && (m.name === 'Meci' || m.name === 'Match')
        )
        if (!h2hMarket || h2hMarket.outcomes.length < 3) continue

        const oddsMap: Record<string, number> = {}
        h2hMarket.outcomes.forEach(o => { oddsMap[o.name] = o.odds })

        results.push({
          bookmaker: 'casa_pariurilor',
          matchName: f.name,
          homeTeam: homeParticipant.name,
          awayTeam: awayParticipant.name,
          startTime: f.startDatetime,
          homeOdds: oddsMap['1'] || null,
          drawOdds: oddsMap['X'] || null,
          awayOdds: oddsMap['2'] || null,
          tournamentId: f.tournamentId,
          tournamentName: f.tournamentSeoName,
          eventId: f.id,
        })
      }

      return results
    },
    CACHE_TTL.ODDS
  )
}

// Also fetch tomorrow's odds for advance planning
export async function fetchCasaPariurilorTomorrow(): Promise<RomanianOdds[]> {
  return fetchCasaPariurilorOdds('tomorrow')
}

// ============================================================================
// Las Vegas (Exalogic platform) API
// ============================================================================

const LASVEGAS_BASE = 'https://exalogic.lasvegas.ro/XSportDatastore'

interface LasVegasEvent {
  p: number // event ID
  dsl: { RO?: string; EN?: string; ORIGINAL_FROM_DB?: string }
  ts: string // "YYYYMMDD HH:mm:ss"
  scs: LasVegasMarket[]
}

interface LasVegasMarket {
  cs: number // market type (3 = FINAL/1X2)
  d: string // market description
  eqs: { ce: number; q: number }[] // outcomes: ce=1(home), ce=2(draw), ce=3(away); q=odds*100
}

export async function fetchLasVegasOdds(
  dateStr?: string // YYYY-MM-DD
): Promise<RomanianOdds[]> {
  const today = dateStr || new Date().toISOString().split('T')[0]
  const dateParam = today.replace(/-/g, '') // YYYYMMDD
  const cacheKey = `ro:lasvegas:${today}`

  return getCached(
    cacheKey,
    async () => {
      // idSport=1 = Football, idAggregata=1 = All football
      const url = `${LASVEGAS_BASE}/getPalinsestoDelGiorno?systemCode=LASVEGAS&lingua=RO&hash=&data=${dateParam}&idSport=1&idAggregata=1&timezone=2`

      const res = await fetch(url, {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.lasvegas.ro/',
          'Origin': 'https://www.lasvegas.ro',
        },
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        console.error(`Las Vegas API error: ${res.status}`)
        return []
      }

      const json = await res.json()
      const events: LasVegasEvent[] = json.avs?.avs || []

      const results: RomanianOdds[] = []

      for (const ev of events) {
        const matchName = ev.dsl?.RO || ev.dsl?.EN || ''
        if (!matchName || !matchName.includes(' - ')) continue

        // Find the 1X2/Final market (cs=3, d="FINAL")
        const h2hMarket = ev.scs?.find(s => s.cs === 3 && s.d === 'FINAL')
        if (!h2hMarket || !h2hMarket.eqs || h2hMarket.eqs.length < 3) continue

        const homeOdd = h2hMarket.eqs.find(e => e.ce === 1)
        const drawOdd = h2hMarket.eqs.find(e => e.ce === 2)
        const awayOdd = h2hMarket.eqs.find(e => e.ce === 3)

        const parts = matchName.split(' - ')
        const homeTeam = parts[0]?.trim()
        const awayTeam = parts.slice(1).join(' - ').trim() // Handle team names with "-"

        if (!homeTeam || !awayTeam) continue

        // Parse timestamp "YYYYMMDD HH:mm:ss"
        const tsStr = ev.ts
        const year = tsStr.substring(0, 4)
        const month = tsStr.substring(4, 6)
        const day = tsStr.substring(6, 8)
        const time = tsStr.substring(9)
        const startTime = new Date(`${year}-${month}-${day}T${time}`).getTime()

        results.push({
          bookmaker: 'las_vegas',
          matchName,
          homeTeam,
          awayTeam,
          startTime,
          homeOdds: homeOdd ? homeOdd.q / 100 : null,   // Convert from int (229 -> 2.29)
          drawOdds: drawOdd ? drawOdd.q / 100 : null,
          awayOdds: awayOdd ? awayOdd.q / 100 : null,
          eventId: String(ev.p),
        })
      }

      return results
    },
    CACHE_TTL.ODDS
  )
}

// ============================================================================
// Baum Bet (betx.bet platform) API
// ============================================================================

const BAUMBET_BASE = 'https://sportapis-rom.betx.bet/SportsOfferApi/api/sport/offer/v3'

interface BaumBetMatch {
  Id: number
  TeamHome: string
  TeamAway: string
  OriginalTeamHome: string
  OriginalTeamAway: string
  Description: string
  MatchStartTime: string
  SportId: number
  CategoryName: string
  LeagueName: string
  BasicOffer?: {
    Odds: Array<{
      Name: string // "1", "X", "2"
      Odd: number
      Active: boolean
    }>
  }
}

interface BaumBetSport {
  Id: number
  Name: string
  Categories: Array<{
    Name: string
    Leagues: Array<{
      Name: string
      Matches: BaumBetMatch[]
    }>
  }>
}

export async function fetchBaumBetOdds(
  dateStr?: string // YYYY-MM-DD
): Promise<RomanianOdds[]> {
  const today = dateStr || new Date().toISOString().split('T')[0]
  const cacheKey = `ro:baumbet:${today}`

  return getCached(
    cacheKey,
    async () => {
      const dateFrom = new Date(today).toISOString()
      const dateTo = new Date(new Date(today).getTime() + 7 * 86400000).toISOString()

      // BetTypeKey=1 = Basic Offer (1X2), SportIds=388 = Soccer
      const url = `${BAUMBET_BASE}/sports/offer?Offset=0&Limit=200&DateFrom=${dateFrom}&SportIds=388&DateTo=${dateTo}&BetTypeKey=1`

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      })

      if (!res.ok) {
        console.error(`Baum Bet API error: ${res.status}`)
        return []
      }

      const json = await res.json()
      // Response can be { Count, Response: [...] } or just [...]
      const sports: BaumBetSport[] = json.Response || json
      const soccer = Array.isArray(sports) ? sports.find(s => s.Name === 'Soccer') : null
      if (!soccer || !soccer.Categories) return []

      const results: RomanianOdds[] = []

      for (const category of soccer.Categories) {
        for (const league of category.Leagues) {
          if (!league.Matches) continue
          for (const match of league.Matches) {
            const odds = match.BasicOffer?.Odds || []
            const homeOdd = odds.find(o => o.Name === '1' && o.Active !== false)
            const drawOdd = odds.find(o => o.Name === 'X' && o.Active !== false)
            const awayOdd = odds.find(o => o.Name === '2' && o.Active !== false)

            if (!homeOdd || !drawOdd || !awayOdd) continue

            results.push({
              bookmaker: 'baum_bet',
              matchName: match.Description || `${match.TeamHome}-${match.TeamAway}`,
              homeTeam: match.OriginalTeamHome || match.TeamHome,
              awayTeam: match.OriginalTeamAway || match.TeamAway,
              startTime: new Date(match.MatchStartTime).getTime(),
              homeOdds: homeOdd.Odd,
              drawOdds: drawOdd.Odd,
              awayOdds: awayOdd.Odd,
              tournamentName: `${category.Name} / ${league.Name}`,
              eventId: String(match.Id),
            })
          }
        }
      }

      return results
    },
    CACHE_TTL.ODDS
  )
}

// ============================================================================
// Combined: Fetch from all available Romanian bookmakers
// ============================================================================

export async function fetchAllRomanianOdds(
  dateStr?: string
): Promise<RomanianOdds[]> {
  const [superbetOdds, casaOdds, lasVegasOdds, baumBetOdds] = await Promise.allSettled([
    fetchSuperbetOdds(dateStr),
    fetchCasaPariurilorOdds('today'),
    fetchLasVegasOdds(dateStr),
    fetchBaumBetOdds(dateStr),
  ])

  const results: RomanianOdds[] = []

  if (superbetOdds.status === 'fulfilled') {
    results.push(...superbetOdds.value)
  } else {
    console.error('Superbet fetch failed:', superbetOdds.reason)
  }

  if (casaOdds.status === 'fulfilled') {
    results.push(...casaOdds.value)
  } else {
    console.error('Casa Pariurilor fetch failed:', casaOdds.reason)
  }

  if (lasVegasOdds.status === 'fulfilled') {
    results.push(...lasVegasOdds.value)
  } else {
    console.error('Las Vegas fetch failed:', lasVegasOdds.reason)
  }

  if (baumBetOdds.status === 'fulfilled') {
    results.push(...baumBetOdds.value)
  } else {
    console.error('Baum Bet fetch failed:', baumBetOdds.reason)
  }

  return results
}

// ============================================================================
// Value Alert Logic: Compare Romanian vs International odds
// ============================================================================

const VALUE_THRESHOLD_PCT = 5 // 5% higher odds = value alert

export function detectValueAlerts(
  romanianOdds: { home: number | null; draw: number | null; away: number | null; bookmaker: string },
  international: { avgHome: number | null; avgDraw: number | null; avgAway: number | null; bestHome: number | null; bestDraw: number | null; bestAway: number | null },
  homeTeam: string,
  awayTeam: string
): ValueAlert[] {
  const alerts: ValueAlert[] = []

  const checks: Array<{
    selection: 'home' | 'draw' | 'away'
    roOdds: number | null
    intAvg: number | null
    intBest: number | null
    label: string
  }> = [
    { selection: 'home', roOdds: romanianOdds.home, intAvg: international.avgHome, intBest: international.bestHome, label: homeTeam },
    { selection: 'draw', roOdds: romanianOdds.draw, intAvg: international.avgDraw, intBest: international.bestDraw, label: 'Draw' },
    { selection: 'away', roOdds: romanianOdds.away, intAvg: international.avgAway, intBest: international.bestAway, label: awayTeam },
  ]

  for (const check of checks) {
    if (check.roOdds && check.intAvg && check.intAvg > 1) {
      const edgePct = ((check.roOdds - check.intAvg) / check.intAvg) * 100

      if (edgePct >= VALUE_THRESHOLD_PCT) {
        alerts.push({
          bookmaker: romanianOdds.bookmaker,
          selection: check.selection,
          romanianOdds: check.roOdds,
          internationalAvg: check.intAvg,
          internationalBest: check.intBest || check.intAvg,
          edgePct: Math.round(edgePct * 10) / 10,
          description: `${romanianOdds.bookmaker} offers ${check.roOdds} for ${check.label} (${check.selection}) — ${edgePct.toFixed(1)}% above international avg ${check.intAvg.toFixed(2)}`,
        })
      }
    }
  }

  return alerts
}
