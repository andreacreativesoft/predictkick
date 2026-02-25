import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getOddsForLeague, findBestOdds, LEAGUE_TO_SPORT_KEY } from '@/lib/api/odds-api'
import { ACTIVE_LEAGUES } from '@/lib/utils/constants'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

// Common aliases: Odds API name -> list of DB names that should match
const TEAM_ALIASES: Record<string, string[]> = {
  'benfica': ['sport lisboa e benfica', 'sl benfica', 'benfica'],
  'sporting cp': ['sporting clube de portugal', 'sporting cp', 'sporting lisbon', 'sporting lisboa'],
  'porto': ['fc porto', 'porto'],
  'paris saint germain': ['paris saint-germain', 'paris saint germain', 'psg'],
  'bayern munich': ['bayern munchen', 'fc bayern munchen', 'bayern munich', 'bayern münchen'],
  'atletico madrid': ['atletico de madrid', 'club atletico de madrid', 'atletico madrid', 'atlético madrid', 'atlético de madrid'],
  'inter milan': ['inter', 'fc internazionale milano', 'internazionale', 'inter milan'],
  'ac milan': ['milan', 'ac milan'],
  'rb leipzig': ['rasenballsport leipzig', 'rb leipzig', 'rbl'],
  'man city': ['manchester city', 'man city'],
  'man united': ['manchester united', 'man united', 'man utd'],
  'tottenham': ['tottenham hotspur', 'spurs', 'tottenham'],
  'wolves': ['wolverhampton wanderers', 'wolverhampton', 'wolves'],
  'brighton': ['brighton and hove albion', 'brighton & hove albion', 'brighton'],
  'nottingham forest': ["nottingham forest", "nott'm forest"],
  'west ham': ['west ham united', 'west ham'],
  'newcastle': ['newcastle united', 'newcastle'],
  'sheffield utd': ['sheffield united', 'sheffield utd'],
  'real sociedad': ['real sociedad', 'real sociedad de futbol'],
  'real betis': ['real betis', 'real betis balompie'],
  'celta vigo': ['celta de vigo', 'celta vigo', 'rc celta'],
  'red star belgrade': ['fk crvena zvezda', 'crvena zvezda', 'red star belgrade'],
  'club brugge': ['club brugge kv', 'club brugge', 'club bruges'],
  'celtic': ['celtic fc', 'celtic glasgow', 'celtic'],
  'feyenoord': ['feyenoord rotterdam', 'feyenoord'],
  'psv': ['psv eindhoven', 'psv'],
  'shakhtar donetsk': ['shakhtar donetsk', 'fc shakhtar donetsk', 'shakhtar'],
  'dynamo kyiv': ['dynamo kyiv', 'fc dynamo kyiv'],
  'red bull salzburg': ['fc red bull salzburg', 'rb salzburg', 'red bull salzburg', 'fc salzburg'],
  'slavia prague': ['sk slavia praha', 'slavia prague', 'slavia praha'],
  'sparta prague': ['ac sparta praha', 'sparta prague', 'sparta praha'],
  'young boys': ['bsc young boys', 'young boys'],
  'sturm graz': ['sk sturm graz', 'sturm graz'],
  'lille': ['losc lille', 'lille osc', 'lille'],
  'monaco': ['as monaco', 'monaco'],
  'lyon': ['olympique lyonnais', 'ol lyon', 'lyon'],
  'marseille': ['olympique de marseille', 'om marseille', 'marseille'],
  'brest': ['stade brestois 29', 'brest'],
}

// Normalize team name for fuzzy matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, ' ')       // paris saint-germain -> paris saint germain
    .replace(/\b(fc|cf|sc|ac|as|ss|us|afc|ssc|rcd|rc|cd|ud|sd|ca|se|bsc|vfb|rb|sv|tsg|sk|1\.|fk|nk|bv|kv)\b/gi, '')
    .replace(/\b(football|club|sport|calcio|sportif|united|athletic|athletico|wanderers|rovers|hotspur|albion)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Get all alias forms for a team name
function getAliases(name: string): string[] {
  const lower = name.toLowerCase().replace(/-/g, ' ').trim()
  for (const [key, aliases] of Object.entries(TEAM_ALIASES)) {
    if (lower.includes(key) || aliases.some(a => lower.includes(a) || a.includes(lower))) {
      return aliases.map(a => normalizeTeamName(a))
    }
  }
  return [normalizeTeamName(name)]
}

// Check if two team names match (using aliases + fuzzy matching)
function fuzzyTeamMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true

  // Check word overlap: if any significant word matches
  const aWords = a.split(' ').filter(w => w.length > 2)
  const bWords = b.split(' ').filter(w => w.length > 2)
  const overlap = aWords.filter(w => bWords.includes(w))
  if (overlap.length > 0) return true

  return false
}

// Full team match: try aliases first, then fuzzy
function teamsMatch(oddsName: string, dbName: string): boolean {
  const oddsAliases = getAliases(oddsName)
  const dbAliases = getAliases(dbName)

  // Check if any alias from odds matches any alias from DB
  for (const oa of oddsAliases) {
    for (const da of dbAliases) {
      if (fuzzyTeamMatch(oa, da)) return true
    }
  }

  // Fallback: direct normalized comparison
  return fuzzyTeamMatch(normalizeTeamName(oddsName), normalizeTeamName(dbName))
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let totalSynced = 0
    const errors: string[] = []

    // Pre-fetch all scheduled fixtures for matching
    const { data: allFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, match_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())

    if (!allFixtures || allFixtures.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No scheduled fixtures' })
    }

    for (const leagueId of ACTIVE_LEAGUES) {
      try {
        const sportKey = LEAGUE_TO_SPORT_KEY[leagueId]
        if (!sportKey) continue

        const events = await getOddsForLeague(sportKey, {
          regions: 'eu,uk',
          markets: 'h2h',
        })

        if (!events || events.length === 0) continue

        const bestOdds = findBestOdds(events)
        const oddsCurrentRows: Record<string, unknown>[] = []
        const oddsHistoryRows: Record<string, unknown>[] = []

        for (const event of events) {
          // Match to fixture by team name + date proximity
          const eventDate = new Date(event.commence_time)

          const matched = allFixtures.find(f => {
            const fDate = new Date(f.match_date)
            const withinDay = Math.abs(fDate.getTime() - eventDate.getTime()) < 86400000
            if (!withinDay) return false

            const fHomeName = (f.home_team as unknown as { name: string })?.name || ''
            const fAwayName = (f.away_team as unknown as { name: string })?.name || ''
            return teamsMatch(event.home_team, fHomeName) && teamsMatch(event.away_team, fAwayName)
          })

          if (!matched) continue

          const best = bestOdds.find(b => b.event_id === event.id)
          if (!best) continue

          const h2hMarkets = event.bookmakers.flatMap(b =>
            b.markets.filter(m => m.key === 'h2h')
          )
          const homeOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.home_team).map(o => o.price))
          const drawOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === 'Draw').map(o => o.price))
          const awayOdds = h2hMarkets.flatMap(m => m.outcomes.filter(o => o.name === event.away_team).map(o => o.price))
          const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

          oddsCurrentRows.push({
            fixture_id: matched.id,
            market: 'h2h',
            best_home_odds: best.best_home.odds || null,
            best_home_bookmaker: best.best_home.bookmaker || null,
            best_draw_odds: best.best_draw.odds || null,
            best_draw_bookmaker: best.best_draw.bookmaker || null,
            best_away_odds: best.best_away.odds || null,
            best_away_bookmaker: best.best_away.bookmaker || null,
            avg_home_odds: avg(homeOdds),
            avg_draw_odds: avg(drawOdds),
            avg_away_odds: avg(awayOdds),
            line: null,
            updated_at: new Date().toISOString(),
          })

          // Collect history rows
          for (const bookmaker of event.bookmakers) {
            for (const market of bookmaker.markets.filter(m => m.key === 'h2h')) {
              oddsHistoryRows.push({
                fixture_id: matched.id,
                bookmaker: bookmaker.key,
                market: 'h2h',
                home_odds: market.outcomes.find(o => o.name === event.home_team)?.price || null,
                draw_odds: market.outcomes.find(o => o.name === 'Draw')?.price || null,
                away_odds: market.outcomes.find(o => o.name === event.away_team)?.price || null,
                line: null,
                is_live: false,
                snapshot_at: new Date().toISOString(),
              })
            }
          }
        }

        // Batch upsert odds_current
        if (oddsCurrentRows.length > 0) {
          const { error } = await supabaseAdmin
            .from('odds_current')
            .upsert(oddsCurrentRows, { onConflict: 'fixture_id,market,line' })
          if (!error) totalSynced += oddsCurrentRows.length
          else errors.push(`League ${leagueId} odds_current: ${error.message}`)
        }

        // Batch insert odds_history
        if (oddsHistoryRows.length > 0) {
          for (let i = 0; i < oddsHistoryRows.length; i += 100) {
            const chunk = oddsHistoryRows.slice(i, i + 100)
            await supabaseAdmin.from('odds_history').insert(chunk)
          }
        }
      } catch (leagueError) {
        console.error(`sync-odds: League ${leagueId} failed:`, leagueError)
        errors.push(`League ${leagueId}: ${String(leagueError)}`)
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced, errors: errors.length > 0 ? errors : undefined })
  } catch (error) {
    console.error('sync-odds error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
