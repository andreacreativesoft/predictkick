import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

// Process max 5 fixtures per run (fast statistical mode without AI = ~2s each)
const MAX_PER_RUN = 5

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get fixtures in next 3 days that don't have predictions yet
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id, match_date')
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())
      .lte('match_date', threeDaysFromNow.toISOString())
      .order('match_date', { ascending: true })

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ success: true, generated: 0, total: 0, message: 'No upcoming fixtures' })
    }

    // Filter out fixtures that already have predictions
    const { data: existingPredictions } = await supabaseAdmin
      .from('predictions')
      .select('fixture_id')
      .in('fixture_id', fixtures.map(f => f.id))

    const existingIds = new Set(existingPredictions?.map(p => p.fixture_id) || [])
    const needsPrediction = fixtures.filter(f => !existingIds.has(f.id))

    // Limit per run to avoid timeout
    const batch = needsPrediction.slice(0, MAX_PER_RUN)
    let generated = 0
    const errors: string[] = []

    // Skip AI in cron to avoid timeouts — AI enrichment can run separately
    process.env.SKIP_AI_PREDICTION = 'true'

    for (const fixture of batch) {
      try {
        const { generatePrediction } = await import('@/lib/prediction/engine')
        await generatePrediction(fixture.id)
        generated++
      } catch (err) {
        const errMsg = `${fixture.id}: ${String(err).slice(0, 100)}`
        console.error(`Prediction failed for fixture ${fixture.id}:`, err)
        errors.push(errMsg)
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      total: fixtures.length,
      pending: needsPrediction.length - generated,
      already_predicted: existingIds.size,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('generate-predictions error:', error)
    return NextResponse.json({ error: 'Generation failed', details: String(error) }, { status: 500 })
  }
}
