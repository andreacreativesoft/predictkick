import { getCached } from '@/lib/cache/redis'
import { CACHE_TTL } from '@/lib/utils/constants'
import type { WeatherResponse, WeatherForecastResponse } from '@/lib/types/api'

const BASE_URL = 'https://api.openweathermap.org/data/2.5'

async function weatherFetch<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured')

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('appid', apiKey)
  url.searchParams.set('units', 'metric')
  Object.entries(params).forEach(([key, val]) =>
    url.searchParams.set(key, String(val))
  )

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })

  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

// ==========================================
// Current Weather
// ==========================================

export async function getCurrentWeather(
  lat: number,
  lng: number
): Promise<WeatherResponse> {
  const cacheKey = `weather:current:${lat}:${lng}`

  return getCached(
    cacheKey,
    async () => weatherFetch<WeatherResponse>('/weather', { lat, lon: lng }),
    CACHE_TTL.WEATHER
  )
}

// ==========================================
// Forecast (5 day / 3 hour)
// ==========================================

export async function getWeatherForecast(
  lat: number,
  lng: number
): Promise<WeatherForecastResponse> {
  const cacheKey = `weather:forecast:${lat}:${lng}`

  return getCached(
    cacheKey,
    async () => weatherFetch<WeatherForecastResponse>('/forecast', { lat, lon: lng }),
    CACHE_TTL.WEATHER
  )
}

// ==========================================
// Weather at Match Time
// ==========================================

export async function getWeatherAtMatchTime(
  lat: number,
  lng: number,
  matchDate: Date
): Promise<{
  temperature: number
  feels_like: number
  humidity: number
  wind_speed: number
  wind_direction: number
  rain_probability: number
  rain_mm: number
  snow_probability: number
  condition: string
  visibility: number
}> {
  const forecast = await getWeatherForecast(lat, lng)
  const matchTimestamp = matchDate.getTime() / 1000

  // Find the closest forecast entry to match time
  let closest = forecast.list[0]
  let minDiff = Math.abs(closest.dt - matchTimestamp)

  for (const entry of forecast.list) {
    const diff = Math.abs(entry.dt - matchTimestamp)
    if (diff < minDiff) {
      minDiff = diff
      closest = entry
    }
  }

  return {
    temperature: closest.main.temp,
    feels_like: closest.main.feels_like,
    humidity: closest.main.humidity,
    wind_speed: closest.wind.speed,
    wind_direction: closest.wind.deg,
    rain_probability: closest.pop * 100,
    rain_mm: closest.rain?.['3h'] || 0,
    snow_probability: closest.snow ? closest.pop * 100 : 0,
    condition: closest.weather[0]?.description || 'unknown',
    visibility: closest.visibility,
  }
}

// ==========================================
// Weather Impact Score
// ==========================================

export function calculateWeatherImpact(weather: {
  temperature: number
  wind_speed: number
  rain_mm: number
  snow_probability: number
  condition: string
}): { score: number; description: string } {
  let impact = 0
  const factors: string[] = []

  // Temperature impact
  if (weather.temperature < 0) {
    impact += 0.15
    factors.push('Freezing conditions')
  } else if (weather.temperature < 5) {
    impact += 0.08
    factors.push('Very cold')
  } else if (weather.temperature > 35) {
    impact += 0.12
    factors.push('Extreme heat')
  } else if (weather.temperature > 30) {
    impact += 0.06
    factors.push('Hot conditions')
  }

  // Wind impact
  if (weather.wind_speed > 15) {
    impact += 0.15
    factors.push('Very strong wind')
  } else if (weather.wind_speed > 10) {
    impact += 0.08
    factors.push('Strong wind')
  } else if (weather.wind_speed > 7) {
    impact += 0.03
    factors.push('Moderate wind')
  }

  // Rain impact
  if (weather.rain_mm > 5) {
    impact += 0.12
    factors.push('Heavy rain')
  } else if (weather.rain_mm > 2) {
    impact += 0.06
    factors.push('Moderate rain')
  } else if (weather.rain_mm > 0) {
    impact += 0.02
    factors.push('Light rain')
  }

  // Snow
  if (weather.snow_probability > 50) {
    impact += 0.20
    factors.push('Snow expected')
  }

  return {
    score: Math.min(impact, 1),
    description: factors.length > 0
      ? `Weather impact: ${factors.join(', ')}`
      : 'Normal weather conditions',
  }
}
