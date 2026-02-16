// API response types for external services

// ==========================================
// API-Football Response Types
// ==========================================

export interface FootballAPIResponse<T> {
  get: string
  parameters: Record<string, string>
  errors: Record<string, string> | string[]
  results: number
  paging: { current: number; total: number }
  response: T[]
}

export interface FootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: { first: number | null; second: number | null }
    venue: { id: number; name: string; city: string }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string
    season: number
    round: string
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
  events?: FootballEvent[]
  lineups?: FootballLineup[]
  statistics?: FootballStatistic[]
}

export interface FootballEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number; name: string; logo: string }
  player: { id: number; name: string }
  assist: { id: number | null; name: string | null }
  type: string
  detail: string
  comments: string | null
}

export interface FootballLineup {
  team: { id: number; name: string; logo: string }
  formation: string
  startXI: Array<{ player: { id: number; name: string; number: number; pos: string } }>
  substitutes: Array<{ player: { id: number; name: string; number: number; pos: string } }>
  coach: { id: number; name: string; photo: string }
}

export interface FootballStatistic {
  team: { id: number; name: string; logo: string }
  statistics: Array<{ type: string; value: number | string | null }>
}

export interface FootballStanding {
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string
    season: number
    standings: Array<Array<{
      rank: number
      team: { id: number; name: string; logo: string }
      points: number
      goalsDiff: number
      group: string
      form: string
      status: string
      description: string | null
      all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
      home: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
      away: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
      update: string
    }>>
  }
}

export interface FootballInjury {
  player: { id: number; name: string; photo: string; type: string; reason: string }
  team: { id: number; name: string; logo: string }
  fixture: { id: number; timezone: string; date: string; timestamp: number }
  league: { id: number; season: number; name: string; country: string; logo: string; flag: string }
}

export interface FootballH2H {
  fixture: FootballFixture['fixture']
  league: FootballFixture['league']
  teams: FootballFixture['teams']
  goals: FootballFixture['goals']
  score: FootballFixture['score']
}

// ==========================================
// The Odds API Response Types
// ==========================================

export interface OddsAPIResponse {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsBookmaker[]
}

export interface OddsBookmaker {
  key: string
  title: string
  last_update: string
  markets: OddsMarket[]
}

export interface OddsMarket {
  key: string  // 'h2h', 'spreads', 'totals'
  last_update: string
  outcomes: OddsOutcome[]
}

export interface OddsOutcome {
  name: string  // 'Home Team', 'Away Team', 'Draw', 'Over', 'Under'
  price: number
  point?: number  // For spreads and totals
}

// ==========================================
// OpenWeatherMap Response Types
// ==========================================

export interface WeatherResponse {
  coord: { lon: number; lat: number }
  weather: Array<{ id: number; main: string; description: string; icon: string }>
  main: {
    temp: number
    feels_like: number
    temp_min: number
    temp_max: number
    pressure: number
    humidity: number
  }
  visibility: number
  wind: { speed: number; deg: number; gust?: number }
  rain?: { '1h'?: number; '3h'?: number }
  snow?: { '1h'?: number; '3h'?: number }
  clouds: { all: number }
  dt: number
  sys: { country: string; sunrise: number; sunset: number }
  timezone: number
  name: string
}

export interface WeatherForecastResponse {
  list: Array<{
    dt: number
    main: WeatherResponse['main']
    weather: WeatherResponse['weather']
    wind: WeatherResponse['wind']
    rain?: { '3h'?: number }
    snow?: { '3h'?: number }
    visibility: number
    pop: number  // Probability of precipitation
    dt_txt: string
  }>
  city: {
    id: number
    name: string
    coord: { lat: number; lon: number }
    country: string
    timezone: number
  }
}

// ==========================================
// GNews API Response Types
// ==========================================

export interface GNewsResponse {
  totalArticles: number
  articles: GNewsArticle[]
}

export interface GNewsArticle {
  title: string
  description: string
  content: string
  url: string
  image: string
  publishedAt: string
  source: {
    name: string
    url: string
  }
}

// ==========================================
// Claude API Types (for our wrapper)
// ==========================================

export interface ClaudeAnalysisRequest {
  fixture_summary: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats_data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  h2h_data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  injuries: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context_factors: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weather: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  odds: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manual_inputs: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_prediction: any
}

export interface ClaudeAnalysisResponse {
  probability_adjustments: {
    home_win: number
    draw: number
    away_win: number
  }
  narrative: string
  key_factors: string[]
  risk_factors: string[]
  non_obvious_patterns: string[]
  recommended_markets: string[]
  confidence_override: number | null
}
