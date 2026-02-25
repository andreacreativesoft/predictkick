import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // injury_news, scandal, transfer_news, or 'all'
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100)

    let query = supabaseAdmin
      .from('contextual_factors')
      .select(`
        *,
        team:teams(id, name, short_name, logo_url)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by news-related factor types
    const newsTypes = ['injury_news', 'scandal', 'transfer_news']
    if (category && category !== 'all' && newsTypes.includes(category)) {
      query = query.eq('factor_type', category)
    } else {
      query = query.in('factor_type', newsTypes)
    }

    const { data: news, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get counts by category
    const { data: counts } = await supabaseAdmin
      .from('contextual_factors')
      .select('factor_type')
      .eq('is_active', true)
      .in('factor_type', newsTypes)

    const categoryCounts = {
      all: counts?.length || 0,
      injury_news: counts?.filter(c => c.factor_type === 'injury_news').length || 0,
      scandal: counts?.filter(c => c.factor_type === 'scandal').length || 0,
      transfer_news: counts?.filter(c => c.factor_type === 'transfer_news').length || 0,
    }

    return NextResponse.json({
      news: news || [],
      counts: categoryCounts,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
