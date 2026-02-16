-- 006_weather.sql

CREATE TABLE match_weather (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID REFERENCES fixtures(id),
  pre_temperature DECIMAL(4,1),
  pre_feels_like DECIMAL(4,1),
  pre_humidity INTEGER,
  pre_wind_speed DECIMAL(5,2),
  pre_wind_direction INTEGER,
  pre_rain_probability DECIMAL(4,1),
  pre_rain_mm DECIMAL(5,2),
  pre_snow_probability DECIMAL(4,1),
  pre_condition TEXT,
  pre_visibility INTEGER,
  hourly_forecast JSONB,
  live_temperature DECIMAL(4,1),
  live_condition TEXT,
  live_wind_speed DECIMAL(5,2),
  live_rain_mm DECIMAL(5,2),
  weather_impact_score DECIMAL(3,2),
  weather_impact_description TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
