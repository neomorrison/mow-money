// Small SVG charts drawn at the container's real pixel size, with a hover crosshair and tooltip.
// Usage: chartSlot(cfg) in a render(), then drawCharts(root) in the screen's after().
import { html, type Raw } from './html';

export interface Series { name: string; color: string; values: number[] }
export interface ChartCfg {
  kind: 'line' | 'bars';
  series: Series[];
  labels: string[];           // x labels (one per point)
  fmt: (v: number) => string; // value formatter
  height?: number;
  yMin?: number;
  yMax?: number;
  area?: boolean;
}

const registry = new Map<string, ChartCfg>();
let nextId = 1;

export function chartSlot(cfg: ChartCfg, label: string): Raw {
  const id = `c${nextId++}`;
  registry.set(id, cfg);
  if (registry.size > 60) registry.delete(registry.keys().next().value as string);
  const legend = cfg.series.length > 1
    ? html`<div class="ui-legend">${cfg.series.map((s) => html`<span><i style="background:${s.color}"></i>${s.name}</span>`)}</div>`
    : '';
  return html`${legend}<div class="ui-chart" data-chart="${id}" style="height:${cfg.height || 200}px" role="img" aria-label="${label}"></div>`;
}

function niceStep(span: number, ticks: number): number {
  const raw = span / Math.max(1, ticks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return f * mag;
}

export function drawCharts(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.ui-chart[data-chart]').forEach((el) => {
    const cfg = registry.get(el.dataset.chart || '');
    if (cfg) draw(el, cfg);
  });
}

let resizeBound = false;
export function bindChartResize(getRoot: () => HTMLElement | null): void {
  if (resizeBound) return;
  resizeBound = true;
  let t: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { const r = getRoot(); if (r) drawCharts(r); }, 120);
  });
}

function draw(el: HTMLElement, cfg: ChartCfg): void {
  const W = Math.max(200, el.clientWidth);
  const H = cfg.height || 200;
  const n = cfg.labels.length;
  const all = cfg.series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (!n || !all.length) {
    el.innerHTML = '<div class="ui-chart__empty">Not enough days yet.</div>';
    return;
  }
  let lo = cfg.yMin ?? Math.min(0, ...all);
  let hi = cfg.yMax ?? Math.max(...all);
  if (hi - lo < 1e-9) { hi = lo + 1; }
  const step = niceStep(hi - lo, 4);
  lo = cfg.yMin ?? Math.floor(lo / step) * step;
  hi = cfg.yMax ?? Math.ceil(hi / step) * step;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  // measure widest y label to set the left gutter
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(v);
  const labW = Math.max(...ticks.map((v) => cfg.fmt(v).length)) * 6.6 + 8;
  const x0 = padL + labW;
  const x1 = W - padR;
  const y0 = padT;
  const y1 = H - padB;
  const X = (i: number) => (cfg.kind === 'bars' ? x0 + ((i + 0.5) * (x1 - x0)) / n : n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
  const Y = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const parts: string[] = [];
  // grid + y labels
  for (const v of ticks) {
    const y = Y(v).toFixed(1);
    parts.push(`<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" class="ui-chart__grid${Math.abs(v) < 1e-9 ? ' is-zero' : ''}"/>`);
    parts.push(`<text x="${x0 - 8}" y="${y}" class="ui-chart__ylab" text-anchor="end" dominant-baseline="middle">${esc(cfg.fmt(v))}</text>`);
  }
  // x labels: at most ~6
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((x1 - x0) / 70))));
  for (let i = 0; i < n; i += every) parts.push(`<text x="${X(i).toFixed(1)}" y="${H - 6}" class="ui-chart__xlab" text-anchor="middle">${esc(cfg.labels[i])}</text>`);
  if (cfg.kind === 'bars') {
    const s = cfg.series[0];
    const bw = Math.max(2, Math.min(22, ((x1 - x0) / n) - 2));
    const zero = Y(Math.max(lo, Math.min(hi, 0)));
    s.values.forEach((v, i) => {
      const y = Y(v);
      const top = Math.min(y, zero);
      const h = Math.max(1, Math.abs(zero - y));
      const color = v >= 0 ? s.color : 'var(--ui-red)';
      const r = Math.min(4, bw / 2, h);
      const x = X(i) - bw / 2;
      // rounded on the data end only
      const d = v >= 0
        ? `M${x} ${zero} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${zero} Z`
        : `M${x} ${zero} V${top + h - r} Q${x} ${top + h} ${x + r} ${top + h} H${x + bw - r} Q${x + bw} ${top + h} ${x + bw} ${top + h - r} V${zero} Z`;
      parts.push(`<path d="${d}" fill="${color}"/>`);
    });
  } else {
    cfg.series.forEach((s) => {
      const pts = s.values.map((v, i) => [X(i), Y(v)] as const);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      if (cfg.area !== false && cfg.series.length === 1) {
        parts.push(`<path d="${d} L${pts[pts.length - 1][0].toFixed(1)} ${y1} L${pts[0][0].toFixed(1)} ${y1} Z" fill="${s.color}" opacity="0.12"/>`);
      }
      parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
      const last = pts[pts.length - 1];
      parts.push(`<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="${s.color}" stroke="var(--ui-paper)" stroke-width="2"/>`);
    });
  }
  parts.push(`<line class="ui-chart__cross" x1="0" x2="0" y1="${y0}" y2="${y1}" style="display:none"/>`);
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}<g class="ui-chart__dots"></g></svg><div class="ui-chart__tip" style="display:none"></div>`;

  const svg = el.querySelector('svg')!;
  const cross = svg.querySelector<SVGLineElement>('.ui-chart__cross')!;
  const dots = svg.querySelector<SVGGElement>('.ui-chart__dots')!;
  const tip = el.querySelector<HTMLElement>('.ui-chart__tip')!;
  const move = (clientX: number) => {
    const r = svg.getBoundingClientRect();
    const px = clientX - r.left;
    let i: number;
    if (cfg.kind === 'bars') i = Math.floor(((px - x0) / (x1 - x0)) * n);
    else i = n === 1 ? 0 : Math.round(((px - x0) / (x1 - x0)) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const x = X(i);
    cross.setAttribute('x1', String(x));
    cross.setAttribute('x2', String(x));
    cross.style.display = '';
    dots.innerHTML = cfg.kind === 'line' ? cfg.series.map((s) => `<circle cx="${x}" cy="${Y(s.values[i])}" r="5" fill="${s.color}" stroke="var(--ui-paper)" stroke-width="2"/>`).join('') : '';
    tip.innerHTML = `<b>${esc(cfg.labels[i])}</b>` + cfg.series.map((s) => `<div><i style="background:${s.values[i] < 0 && cfg.kind === 'bars' ? 'var(--ui-red)' : s.color}"></i>${esc(s.name)} <b>${esc(cfg.fmt(s.values[i]))}</b></div>`).join('');
    tip.style.display = '';
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.max(0, Math.min(W - tw, x - tw / 2))}px`;
  };
  const leave = () => { cross.style.display = 'none'; tip.style.display = 'none'; dots.innerHTML = ''; };
  el.onpointermove = (e) => move(e.clientX);
  el.onpointerdown = (e) => move(e.clientX);
  el.onpointerleave = leave;
}

function esc(s: string): string { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
