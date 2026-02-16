import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getWeatherAtMatchTime, calculateWeatherImpact } from '@/lib/api/weather-api'
import { validateCronSecret } from '@/lib/utils/validators'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get upcoming fixtures within 5 days that have stadium coordinates
    const fiveDaysFromNow = new Date()
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)

    const { data: fixtures } = await supabaseAdmin
      .from('fixtures')
      .select(`
        id, match_date,
        home_team:teams!fixtures_home_team_id_fkey(
          stadium_lat, stadium_lng
        )
      `)
      .eq('status', 'scheduled')
      .gte('match_date', new Date().toISOString())
      .lte('match_date', fiveDaysFromNow.toISOString())

    if (!fixtures) return NextResponse.json({ success: true, synced: 0 })

    let totalSynced = 0

    for (const fixture of fixtures) {
      const homeTeam = fixture.home_team as unknown as { stadium_lat: number | null; stadium_lng: number | null }
      if (!homeTeam?.stadium_lat || !homeTeam?.stadium_lng) continue

      try {
        const weather = await getWeatherAtMatchTime(
          homeTeam.stadium_lat,
          homeTeam.stadium_lng,
          new Date(fixture.match_date)
        )

        const impact = calculateWeatherImpact(weather)

        await supabaseAdmin.from('match_weather').upsert({
          fixture_id: fixture.id,
          pre_temperature: weather.temperature,
          pre_feels_like: weather.feels_like,
          pre_humidity: weather.humidity,
          pre_wind_speed: weather.wind_speed,
          pre_wind_direction: weather.wind_direction,
          pre_rain_probability: weather.rain_probability,
          pre_rain_mm: weather.rain_mm,
          pre_snow_probability: weather.snow_probability,
          pre_condition: weather.condition,
          pre_visibility: weather.visibility,
          weather_impact_score: impact.score,
          weather_impact_description: impact.description,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        totalSynced++
      } catch (err) {
        console.error(`Weather fetch failed for fixture ${fixture.id}:`, err)
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced })
  } catch (error) {
    console.error('sync-weather error:', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
