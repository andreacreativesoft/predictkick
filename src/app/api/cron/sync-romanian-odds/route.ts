import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAllRomanianOdds, detectValueAlerts } from '@/lib/api/romanian-odds'
import type { RomanianOdds } from '@/lib/api/romanian-odds'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

// Normalize team name for fuzzy matching (mirrors sync-odds logic)
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\b(fc|cf|sc|ac|as|ss|us|afc|ssc|rcd|rc|cd|ud|sd|ca|se|bsc|vfb|rb|sv|tsg|sk|1\.|fk|nk|bv|kv|sl)\b/gi, '')
    .replace(/\b(football|club|sport|calcio|sportif|united|athletic|athletico|wanderers|rovers|hotspur|albion)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Romanian-specific team aliases
const RO_TEAM_ALIASES: Record<string, string[]> = {
  // CL/EL names differences
  'real madrid': ['real madrid', 'real madrid cf'],
  'benfica': ['benfica', 'sl benfica', 'sl benfica lisabona', 'sport lisboa e benfica'],
  'psg': ['psg', 'paris saint germain', 'paris saint-germain', 'paris saint-germain fc'],
  'monaco': ['monaco', 'as monaco', 'as monaco fc'],
  'juventus': ['juventus', 'juventus fc', 'juventus torino'],
  'galatasaray': ['galatasaray', 'galatasaray sk'],
  'atalanta': ['atalanta', 'atalanta bc'],
  'dortmund': ['dortmund', 'borussia dortmund', 'bvb'],
  'inter': ['inter', 'inter milan', 'fc internazionale milano', 'internazionale'],
  'ac milan': ['ac milan', 'milan'],
  'barcelona': ['barcelona', 'fc barcelona'],
  'atletico madrid': ['atletico madrid', 'atletico de madrid', 'atl. madrid', 'club atletico de madrid'],
  'bayern': ['bayern', 'bayern munich', 'bayern munchen', 'fc bayern munchen'],
  'man city': ['man city', 'manchester city'],
  'man united': ['man utd', 'man united', 'manchester united'],
  'tottenham': ['tottenham', 'tottenham hotspur', 'spurs'],
  'arsenal': ['arsenal', 'arsenal fc'],
  'liverpool': ['liverpool', 'liverpool fc'],
  'chelsea': ['chelsea', 'chelsea fc'],
  'napoli': ['napoli', 'ssc napoli'],
  'roma': ['roma', 'as roma'],
  'lazio': ['lazio', 'ss lazio'],
  'porto': ['porto', 'fc porto'],
  'sporting cp': ['sporting cp', 'sporting lisbon', 'sporting lisboa', 'sporting clube de portugal'],
  'lille': ['lille', 'losc lille', 'lille osc'],
  'marseille': ['marseille', 'olympique de marseille', 'om'],
  'lyon': ['lyon', 'olympique lyonnais'],
  'rb leipzig': ['rb leipzig', 'rasenballsport leipzig', 'rbl'],
  'leverkusen': ['leverkusen', 'bayer leverkusen', 'bayer 04 leverkusen'],
  'feyenoord': ['feyenoord', 'feyenoord rotterdam'],
  'psv': ['psv', 'psv eindhoven'],
  'club brugge': ['club brugge', 'club brugge kv', 'club bruges'],
  'celtic': ['celtic', 'celtic fc', 'celtic glasgow'],
}

function getAliases(name: string): string[] {
  const lower = name.toLowerCase().replace(/-/g, ' ').trim()
  for (const [, aliases] of Object.entries(RO_TEAM_ALIASES)) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) {
      return aliases.map(a => normalizeTeamName(a))
    }
  }
  return [normalizeTeamName(name)]
}

function fuzzyTeamMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const aWords = a.split(' ').filter(w => w.length > 2)
  const bWords = b.split(' ').filter(w => w.length > 2)
  const overlap = aWords.filter(w => bWords.includes(w))
  if (overlap.length > 0) return true
  return false
}

function teamsMatch(roName: string, dbName: string): boolean {
  const roAliases = getAliases(roName)
  const dbAliases = getAliases(dbName)
  for (const ra of roAliases) {
    for (const da of dbAliases) {
      if (fuzzyTeamMatch(ra, da)) return true
    }
  }
  return fuzzyTeamMatch(normalizeTeamName(roName), normalizeTeamName(dbName))
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Fetch all Romanian odds in parallel
    const romanianOdds = await fetchAllRomanianOdds()

    if (romanianOdds.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No Romanian odds fetched' })
    }

    // 2. Pre-fetch scheduled fixtures with team names
    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, match_date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No scheduled fixtures' })
    }

    // 3. Also fetch current international odds for comparison
    const fixtureIds = fixtures.map(f => f.id)
    const { data: internationalOdds } = await supabaseAdmin
      .from('odds_current')
      .select('fixture_id, best_home_odds, best_draw_odds, best_away_odds, avg_home_odds, avg_draw_odds, avg_away_odds')
      .in('fixture_id', fixtureIds)
      .eq('market', 'h2h')

    interface IntOddsRow {
      fixture_id: string
      best_home_odds: number | null
      best_draw_odds: number | null
      best_away_odds: number | null
      avg_home_odds: number | null
      avg_draw_odds: number | null
      avg_away_odds: number | null
    }
    const intOddsMap = new Map<string, IntOddsRow>()
    for (const io of (internationalOdds || []) as IntOddsRow[]) {
      if (io.fixture_id) intOddsMap.set(io.fixture_id, io)
    }

    // 4. Match Romanian odds to fixtures and build rows
    const romanianRows: Record<string, unknown>[] = []
    const valueAlertRows: Record<string, unknown>[] = []
    let matchCount = 0

    for (const ro of romanianOdds) {
      const eventDate = new Date(ro.startTime)

      const matched = fixtures.find(f => {
        const fDate = new Date(f.match_date)
        const withinDay = Math.abs(fDate.getTime() - eventDate.getTime()) < 86400000
        if (!withinDay) return false

        const fHomeName = (f.home_team as unknown as { name: string })?.name || ''
        const fAwayName = (f.away_team as unknown as { name: string })?.name || ''
        return teamsMatch(ro.homeTeam, fHomeName) && teamsMatch(ro.awayTeam, fAwayName)
      })

      if (!matched) continue
      matchCount++

      romanianRows.push({
        fixture_id: matched.id,
        bookmaker: ro.bookmaker,
        market: 'h2h',
        home_odds: ro.homeOdds,
        draw_odds: ro.drawOdds,
        away_odds: ro.awayOdds,
        source_event_id: ro.eventId || null,
        source_match_name: ro.matchName,
        updated_at: new Date().toISOString(),
      })

      // 5. Check for value alerts (Romanian odds vs international)
      const intOdds = intOddsMap.get(matched.id)
      if (intOdds && ro.homeOdds && ro.drawOdds && ro.awayOdds) {
        const fHomeName = (matched.home_team as unknown as { name: string })?.name || ''
        const fAwayName = (matched.away_team as unknown as { name: string })?.name || ''

        const alerts = detectValueAlerts(
          { home: ro.homeOdds, draw: ro.drawOdds, away: ro.awayOdds, bookmaker: ro.bookmaker },
          {
            avgHome: intOdds.avg_home_odds,
            avgDraw: intOdds.avg_draw_odds,
            avgAway: intOdds.avg_away_odds,
            bestHome: intOdds.best_home_odds,
            bestDraw: intOdds.best_draw_odds,
            bestAway: intOdds.best_away_odds,
          },
          fHomeName,
          fAwayName
        )

        for (const alert of alerts) {
          valueAlertRows.push({
            fixture_id: matched.id,
            bookmaker: alert.bookmaker,
            selection: alert.selection,
            romanian_odds: alert.romanianOdds,
            international_avg: alert.internationalAvg,
            international_best: alert.internationalBest,
            edge_pct: alert.edgePct,
            description: alert.description,
          })
        }
      }
    }

    // 6. Batch upsert Romanian odds
    let syncedCount = 0
    const errors: string[] = []

    if (romanianRows.length > 0) {
      const { error } = await supabaseAdmin
        .from('odds_romanian')
        .upsert(romanianRows, { onConflict: 'fixture_id,bookmaker,market' })
      if (!error) {
        syncedCount = romanianRows.length
      } else {
        errors.push(`odds_romanian upsert: ${error.message}`)
      }
    }

    // 7. Insert value alerts (clear old ones first for same fixtures)
    if (valueAlertRows.length > 0) {
      // Delete old unread alerts for these fixtures to avoid duplicates
      const alertFixtureIds = [...new Set(valueAlertRows.map(r => r.fixture_id))]
      await supabaseAdmin
        .from('odds_value_alerts')
        .delete()
        .in('fixture_id', alertFixtureIds as string[])
        .eq('is_read', false)

      const { error } = await supabaseAdmin
        .from('odds_value_alerts')
        .insert(valueAlertRows)
      if (error) {
        errors.push(`odds_value_alerts insert: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      matched: matchCount,
      alerts: valueAlertRows.length,
      byBookmaker: {
        superbet: romanianOdds.filter(r => r.bookmaker === 'superbet').length,
        casa_pariurilor: romanianOdds.filter(r => r.bookmaker === 'casa_pariurilor').length,
        las_vegas: romanianOdds.filter(r => r.bookmaker === 'las_vegas').length,
        baum_bet: romanianOdds.filter(r => r.bookmaker === 'baum_bet').length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('sync-romanian-odds error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
