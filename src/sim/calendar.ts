// Calendar (docs/DESIGN.md section 3).
import type { CalendarInfo, Season } from '../core/types';
import { SEASONS, SEASON_LENGTH, YEAR_DAYS } from './constants';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };

export function seasonStart(season: Season): number {
  let d = 0;
  for (const s of SEASONS) {
    if (s === season) return d;
    d += SEASON_LENGTH[s];
  }
  return 0;
}

export function calendar(day: number): CalendarInfo {
  const dd = Math.max(0, Math.floor(day));
  const year = Math.floor(dd / YEAR_DAYS) + 1;
  let r = dd % YEAR_DAYS;
  let season: Season = 'spring';
  for (const s of SEASONS) {
    if (r < SEASON_LENGTH[s]) { season = s; break; }
    r -= SEASON_LENGTH[s];
  }
  const dayOfSeason = r + 1;
  const weekday = dd % 7;
  return {
    day: dd,
    year,
    season,
    dayOfSeason,
    seasonLength: SEASON_LENGTH[season],
    weekday,
    weekdayName: WEEKDAYS[weekday],
    isWorkday: weekday !== 6,
    label: `${SEASON_LABEL[season]} ${dayOfSeason}, Year ${year}`,
  };
}

export function seasonOf(day: number): Season {
  return calendar(day).season;
}

/** First day index of the next spring after `day` (or `day` itself if it is spring day 1). */
export function nextSpringDay(day: number): number {
  const y = Math.floor(day / YEAR_DAYS);
  const start = y * YEAR_DAYS;
  return day === start ? day : start + YEAR_DAYS;
}

export function seasonLabel(s: Season): string {
  return SEASON_LABEL[s];
}
