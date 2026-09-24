// Reusable view fragments and safe wrappers around sim calls.
import * as sim from '../sim';
import { store } from '../core/store';
import { audio } from '../audio';
import { portraitUrl, thumbUrl } from '../data/assets';
import type { ActionResult, EquipmentCategory, EquipmentSpec, WeatherKind, Season } from '../core/types';
import { html, raw, type Raw } from './html';
import { icon, starSvg } from './icons';
import { toast } from './overlay';

// ---------------------------------------------------------------- safe sim access
const warned = new Set<string>();
export function safe<T>(fn: () => T, fallback: T, tag = ''): T {
  try {
    return fn();
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    const key = tag + msg;
    if (!warned.has(key)) { warned.add(key); console.warn('[ui] sim call failed', tag, msg); }
    return fallback;
  }
}

/** Run a state-changing sim action, toast the message, commit. Returns ok. */
export function act(fn: () => ActionResult, o: { sound?: string; quietOk?: boolean; saveNow?: boolean } = {}): boolean {
  let r: ActionResult;
  try {
    r = fn();
  } catch (e) {
    console.warn('[ui] action failed', e);
    toast('That did not work. Try again in a moment.', 'bad');
    return false;
  }
  if (!r) return false;
  if (r.ok) {
    if (o.sound) try { audio.play(o.sound); } catch { /* ignore */ }
    if (!o.quietOk && r.message) toast(r.message, 'good');
  } else if (r.message) {
    toast(r.message, 'bad');
  }
  store.commit({ saveNow: o.saveNow });
  return r.ok;
}

// ---------------------------------------------------------------- numbers and colors
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function satColor(s: number): string {
  if (s >= 70) return 'var(--ui-g-500)';
  if (s >= 55) return 'var(--ui-sun-500)';
  if (s >= 40) return 'var(--ui-orange)';
  return 'var(--ui-red)';
}
export function satLabel(s: number): string {
  if (s >= 85) return 'Delighted';
  if (s >= 70) return 'Happy';
  if (s >= 55) return 'Content';
  if (s >= 40) return 'Uneasy';
  return 'At risk';
}
export function qColor(q: number): string {
  if (q >= 85) return 'var(--ui-g-500)';
  if (q >= 70) return 'var(--ui-sun-500)';
  if (q >= 55) return 'var(--ui-orange)';
  return 'var(--ui-red)';
}

export function riskChip(p: number): Raw {
  const pct = p * 100;
  const cls = pct < 2 ? '' : pct < 8 ? 'ui-chip--sun' : pct < 20 ? 'ui-chip--orange' : 'ui-chip--red';
  const label = pct < 1 ? '<1%' : `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
  return html`<span class="ui-chip ${cls}" data-tip="Chance this client leaves in the next 7 days">${label} risk</span>`;
}

// ---------------------------------------------------------------- bars and meters
export function bar(v: number, o: { color?: string; cls?: string; cmp?: number | null; tip?: string } = {}): Raw {
  const val = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  const style = `--v:${val.toFixed(4)};${o.color ? `--c:${o.color};` : ''}`;
  return html`<div class="ui-bar ${o.cls || ''}" style="${style}" ${o.tip ? raw(`data-tip="${o.tip.replace(/"/g, '&quot;')}"`) : ''}><i></i>${
    o.cmp !== undefined && o.cmp !== null ? html`<span class="ui-bar__cmp" style="left:${(clamp(o.cmp, 0, 1) * 100).toFixed(2)}%"></span>` : ''
  }</div>`;
}

export function meter(label: string | Raw, valueText: string, v: number, o: { color?: string; icon?: string; cmp?: number | null; cls?: string } = {}): Raw {
  return html`<div class="ui-meter">
    <span class="ui-meter__label">${o.icon ? raw(icon(o.icon)) : ''}${label}</span>
    <span class="ui-meter__val">${valueText}</span>
    ${bar(v, { color: o.color, cmp: o.cmp, cls: o.cls })}
  </div>`;
}

export function starsView(value: number, o: { lg?: boolean; tip?: boolean } = {}): Raw {
  const out: Raw[] = [];
  for (let i = 0; i < 5; i++) {
    const f = clamp(value - i, 0, 1);
    out.push(html`<span class="ui-star" style="--f:${f.toFixed(3)}">${raw(starSvg('ui-star__bg'))}${raw(starSvg('ui-star__fg'))}</span>`);
  }
  return html`<span class="ui-stars ${o.lg ? 'ui-stars--lg' : ''}" ${o.tip ? raw(`data-tip="${value.toFixed(1)} of 5"`) : ''} aria-label="${value.toFixed(1)} of 5 stars">${out}</span>`;
}

export function ring(progress: number, label: string | number, color?: string): Raw {
  return html`<span class="ui-ring" style="--p:${clamp(progress, 0, 1).toFixed(3)};${color ? `--c:${color}` : ''}"><b>${label}</b></span>`;
}

// ---------------------------------------------------------------- avatars and thumbs
export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z .'-]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const a = parts[0][0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || '';
  return (a + b).toUpperCase();
}
export function hue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function avatar(portrait: string | undefined | null, name: string, size = 44, o: { sq?: boolean; cls?: string } = {}): Raw {
  const h = hue(name || portrait || '?');
  const bg = `linear-gradient(145deg, hsl(${h} 55% 62%), hsl(${(h + 30) % 360} 50% 45%))`;
  const img = portrait ? html`<img src="${portraitUrl(portrait)}" alt="" loading="lazy" data-fallback="hide">` : '';
  return html`<span class="ui-av ${o.sq ? 'ui-av--sq' : ''} ${o.cls || ''}" style="--s:${size}px;--av-bg:${bg}" aria-hidden="true"><span>${initials(name)}</span>${img}</span>`;
}

export const CAT_ICON: Record<EquipmentCategory, string> = { mower: 'mower', trimmer: 'trimmer', blower: 'blower', vehicle: 'truck', addon: 'addon' };
export const CAT_LABEL: Record<EquipmentCategory, string> = { mower: 'Mowers', trimmer: 'Trimmers', blower: 'Blowers', vehicle: 'Vehicles', addon: 'Add-ons' };

export function equipIcon(spec: EquipmentSpec): string {
  if (spec.id === 'bike') return 'bike';
  if (spec.id === 'shears') return 'scissors';
  if (spec.id === 'sharpener') return 'sharpen';
  if (spec.id === 'stripekit') return 'stripes';
  if (spec.id === 'bagger') return 'bag';
  return CAT_ICON[spec.category] || 'box';
}

export function thumb(spec: EquipmentSpec, size = 120): Raw {
  return html`<div class="ui-thumb" style="width:${size}px;height:${size}px">${raw(icon(equipIcon(spec)))}${spec.thumb ? html`<img src="${thumbUrl(spec.thumb)}" alt="" loading="lazy" data-fallback="hide">` : ''}</div>`;
}

// Hide any <img data-fallback="hide"> that fails to load (portraits, thumbs, key art).
export function initImageFallbacks(): void {
  document.addEventListener('error', (e) => {
    const t = e.target as HTMLElement;
    if (t && t.tagName === 'IMG' && (t as HTMLImageElement).dataset.fallback === 'hide') t.remove();
  }, true);
}

// ---------------------------------------------------------------- sparkline
export function sparkline(values: number[], o: { w?: number; h?: number; color?: string; min?: number; max?: number; dots?: boolean } = {}): Raw {
  const w = o.w ?? 90;
  const h = o.h ?? 26;
  if (!values.length) return html`<svg class="ui-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M2 ${h - 2}H${w - 2}" stroke="var(--ui-line-2)" stroke-width="2" stroke-dasharray="3 4" fill="none"/></svg>`;
  const min = o.min ?? Math.min(...values);
  const max = o.max ?? Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (values.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const c = o.color || 'var(--ui-g-600)';
  const last = pts[pts.length - 1];
  return html`<svg class="ui-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${area}" fill="${c}" opacity="0.12"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${c}" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}

// ---------------------------------------------------------------- labels
export const WEATHER_LABEL: Record<WeatherKind, string> = { sunny: 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', heat: 'Heat wave' };
export const WEATHER_NOTE: Record<WeatherKind, string> = {
  sunny: 'Perfect mowing weather.',
  cloudy: 'Mild. Grass grows a little faster.',
  rain: 'Wet grass: clumps and slower mowing.',
  storm: 'Crews stay home. No late penalties.',
  heat: 'Slow growth. Three in a row means drought.',
};
export const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function calSafe(day: number) {
  return safe(() => sim.calendar(day), {
    day, year: Math.floor(day / 98) + 1, season: 'spring' as Season, dayOfSeason: (day % 98) + 1, seasonLength: 28,
    weekday: day % 7, weekdayName: WEEKDAYS[day % 7], isWorkday: day % 7 !== 6, label: `Day ${day + 1}`,
  }, 'calendar');
}

export function freqLabel(f: number): string { return f === 14 ? 'Every 2 weeks' : 'Weekly'; }
export function freqShort(f: number): string { return f === 14 ? '2 wk' : 'wk'; }

export function plural(n: number, one: string, many?: string): string { return `${n} ${n === 1 ? one : many || one + 's'}`; }

export function hoodName(key: string): string {
  const [, hoodId] = key.split('.');
  return HOOD_NAMES[hoodId] || hoodId || key;
}
import { HOOD_BY_ID, TOWN_BY_ID } from '../data/hoods';
const HOOD_NAMES: Record<string, string> = Object.fromEntries(Object.values(HOOD_BY_ID).map((h) => [h.id, h.name]));
export function townName(id: string): string { return TOWN_BY_ID[id]?.name || id; }

export function emptyState(ic: string, title: string, text?: string, action?: Raw): Raw {
  return html`<div class="ui-empty">${raw(icon(ic))}<h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action ? html`<div style="margin-top:14px">${action}</div>` : ''}</div>`;
}

// ---------------------------------------------------------------- count-up animation
export function countUp(el: HTMLElement, from: number, to: number, fmt: (n: number) => string, ms = 900, reduced = false): void {
  if (reduced || from === to || typeof requestAnimationFrame === 'undefined') { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
