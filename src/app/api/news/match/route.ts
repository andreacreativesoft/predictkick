import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fixtureId = searchParams.get('fixture_id')

    if (!fixtureId) {
      return NextResponse.json({ error: 'fixture_id required' }, { status: 400 })
    }

    // Get contextual factors (news) for this fixture + team-agnostic news
    const { data: factors } = await supabaseAdmin
      .from('contextual_factors')
      .select('id, factor_type, title, source, source_url, sentiment, impact_score')
      .eq('is_active', true)
      .in('factor_type', ['injury_news', 'scandal', 'transfer_news'])
      .or(`fixture_id.eq.${fixtureId},fixture_id.is.null`)
      .order('impact_score', { ascending: false })
      .limit(10)

    return NextResponse.json({ news: factors || [] })
  } catch (error) {
    return NextResponse.json({ error: String(error), news: [] }, { status: 500 })
  }
}
