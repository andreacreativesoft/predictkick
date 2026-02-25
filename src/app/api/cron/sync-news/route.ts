import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { searchTeamNews, categorizeNews } from '@/lib/api/news-api'
import { fetchSuperligaNews } from '@/lib/api/superliga-scraper'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

// Romanian keyword patterns for categorizing superliga.ro articles
const RO_INJURY_PATTERN = /accidentat|accidentar|indisponibil|absent|leziune|rupt|genunchi|gleznă|muscular|fractură|operat|recuperar|pierde|lipsesc|ratează/i
const RO_CONTROVERSY_PATTERN = /scandal|suspenda|amendă|protest|demitere|demis|eliminat|cartonaș roșu|sancțion|conflicte|incident/i
const RO_TRANSFER_PATTERN = /transfer|semnat|contract|împrumut|plecat|venit|achiziție|reziliere|negocier/i

function categorizeRomanianArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  if (RO_INJURY_PATTERN.test(text)) return 'injury_news'
  if (RO_CONTROVERSY_PATTERN.test(text)) return 'scandal'
  if (RO_TRANSFER_PATTERN.test(text)) return 'transfer_news'
  return 'general_news'
}

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

    if (!fixtures) return NextResponse.json({ success: true, synced: 0, superliga: 0 })

    let totalSynced = 0
    const processedTeams = new Set<string>()

    // ----- GNews: English-language news -----
    for (const fixture of fixtures) {
      const homeTeam = fixture.home_team as unknown as { id: string; name: string }
      const awayTeam = fixture.away_team as unknown as { id: string; name: string }

      for (const team of [homeTeam, awayTeam]) {
        if (!team || processedTeams.has(team.id)) continue
        processedTeams.add(team.id)

        try {
          const articles = await searchTeamNews(team.name, { max: 5 })
          const categorized = categorizeNews(articles)

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
          console.error(`GNews fetch failed for ${team.name}:`, err)
        }
      }
    }

    // ----- Superliga.ro: Romanian-language news -----
    let superligaSynced = 0
    try {
      const superligaArticles = await fetchSuperligaNews({ max: 15 })

      for (const article of superligaArticles) {
        const category = categorizeRomanianArticle(article.title, article.description)

        // Only store actionable news (injuries, scandals, transfers)
        if (category === 'general_news') continue

        const sentiment = category === 'transfer_news' ? 'neutral' : 'negative'
        const impactScore = category === 'injury_news' ? 0.6 : category === 'scandal' ? 0.5 : 0.4

        // Store as a general contextual factor (not team-specific since we can't
        // reliably match Romanian article text to our team UUIDs without the fixture context)
        await supabaseAdmin.from('contextual_factors').insert({
          factor_type: category,
          title: article.title.substring(0, 200),
          description: article.description?.substring(0, 500) || null,
          sentiment,
          impact_score: impactScore,
          source: 'Superliga.ro',
          source_url: article.url,
          is_active: true,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        superligaSynced++
      }
    } catch (err) {
      console.error('Superliga.ro fetch failed:', err)
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      superliga: superligaSynced,
    })
  } catch (error) {
    console.error('sync-news error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
