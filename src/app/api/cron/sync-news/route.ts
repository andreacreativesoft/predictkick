import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { searchTeamNews, categorizeNews } from '@/lib/api/news-api'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get teams with upcoming fixtures in next 3 days
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select(`
        id,
        home_team:teams!fixtures_home_team_id_fkey(id, name),
        away_team:teams!fixtures_away_team_id_fkey(id, name)
      `)
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())
      .lte('match_date', threeDaysFromNow.toISOString())

    if (!fixtures) return NextResponse.json({ success: true, synced: 0 })

    let totalSynced = 0
    const processedTeams = new Set<string>()

    for (const fixture of fixtures) {
      const homeTeam = fixture.home_team as unknown as { id: string; name: string }
      const awayTeam = fixture.away_team as unknown as { id: string; name: string }

      for (const team of [homeTeam, awayTeam]) {
        if (!team || processedTeams.has(team.id)) continue
        processedTeams.add(team.id)

        try {
          const articles = await searchTeamNews(team.name, { max: 5 })
          const categorized = categorizeNews(articles)

          // Create contextual factors from injury news
          for (const article of categorized.injuries) {
            await supabaseAdmin.from('contextual_factors').insert({
              team_id: team.id,
              fixture_id: fixture.id,
              factor_type: 'injury_news',
              title: article.title.substring(0, 200),
              description: article.description?.substring(0, 500),
              sentiment: 'negative',
              impact_score: 0.6,
              source: article.source.name,
              source_url: article.url,
              is_active: true,
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            })
            totalSynced++
          }

          // Create contextual factors from controversy news
          for (const article of categorized.controversy) {
            await supabaseAdmin.from('contextual_factors').insert({
              team_id: team.id,
              fixture_id: fixture.id,
              factor_type: 'scandal',
              title: article.title.substring(0, 200),
              description: article.description?.substring(0, 500),
              sentiment: 'negative',
              impact_score: 0.5,
              source: article.source.name,
              source_url: article.url,
              is_active: true,
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            })
            totalSynced++
          }
        } catch (err) {
          console.error(`News fetch failed for ${team.name}:`, err)
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-news error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
