import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    // Get active bankroll
    const { data: bankroll } = await supabaseAdmin
      .from('bankroll')
      .select('*')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!bankroll) {
      return NextResponse.json({ bankroll: null })
    }

    // Get recent bets
    const { data: recentBets } = await supabaseAdmin
      .from('bets')
      .select(`
        *,
        fixture:fixtures!bets_fixture_id_fkey(
          home_team:teams!fixtures_home_team_id_fkey(name, short_name),
          away_team:teams!fixtures_away_team_id_fkey(name, short_name),
          match_date
        )
      `)
      .eq('bankroll_id', bankroll.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get recent transactions
    const { data: transactions } = await supabaseAdmin
      .from('bankroll_transactions')
      .select('*')
      .eq('bankroll_id', bankroll.id)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      bankroll,
      recentBets: recentBets || [],
      transactions: transactions || [],
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
