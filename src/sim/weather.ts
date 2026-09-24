// Weather Markov chain (docs/DESIGN.md section 5).
import type { Rng } from '../core/rng';
import type { Season, WeatherKind, WeatherState } from '../core/types';
import { WEATHER_BASE, WEATHER_KINDS, WEATHER_PERSIST, FUEL_START, GROWTH_W } from './constants';
import { seasonOf } from './calendar';

/** Transition row for tomorrow given today (sums to 1). */
export function weatherRow(season: Season, today: WeatherKind): number[] {
  const base = WEATHER_BASE[season];
  const i = WEATHER_KINDS.indexOf(today);
  return base.map((p, j) => (1 - WEATHER_PERSIST) * p + (j === i ? WEATHER_PERSIST : 0));
}

export function rollWeather(rng: Rng, season: Season, today: WeatherKind): WeatherKind {
  const row = weatherRow(season, today);
  let r = rng.next();
  for (let j = 0; j < row.length; j++) {
    r -= row[j];
    if (r <= 0) return WEATHER_KINDS[j];
  }
  return WEATHER_KINDS[WEATHER_KINDS.length - 1];
}

/** Average growth multiplier W for a season's base distribution (for non-client lawns). */
export function avgWeatherMult(season: Season): number {
  const base = WEATHER_BASE[season];
  return WEATHER_KINDS.reduce((s, k, j) => s + base[j] * GROWTH_W[k], 0);
}

export function initialWeather(rng: Rng, day: number): WeatherState {
  const today: WeatherKind = 'sunny';
  const forecast: WeatherKind[] = [];
  let prev: WeatherKind = today;
  for (let i = 1; i <= 3; i++) {
    prev = rollWeather(rng, seasonOf(day + i), prev);
    forecast.push(prev);
  }
  return { today, forecast, heatStreak: 0, drought: false, fuelPrice: FUEL_START };
}

/** Advance one day: tomorrow becomes today and a new day is rolled onto the end of the forecast. */
export function advanceWeather(rng: Rng, w: WeatherState, newDay: number): void {
  const next = w.forecast.shift() ?? rollWeather(rng, seasonOf(newDay), w.today);
  w.today = next;
  const last = w.forecast.length ? w.forecast[w.forecast.length - 1] : next;
  while (w.forecast.length < 3) {
    const d = newDay + w.forecast.length + 1;
    w.forecast.push(rollWeather(rng, seasonOf(d), w.forecast.length ? w.forecast[w.forecast.length - 1] : last));
  }
  if (w.today === 'heat') w.heatStreak += 1;
  else w.heatStreak = 0;
  if (w.heatStreak >= 3) w.drought = true;
  if (w.today === 'rain' || w.today === 'storm') w.drought = false;
}

export function weatherLabel(k: WeatherKind): string {
  return { sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', heat: 'Heat wave' }[k];
}
