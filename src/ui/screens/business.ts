// Business: charts from day summaries, valuation, stats, achievements, sell the company.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, sqft } from '../../core/format';
import type { DaySummary, GameState } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { safe, calSafe, emptyState, starsView } from '../kit';
import { chartSlot, drawCharts, bindChartResize } from '../charts';
import { sellCompanyFlow } from '../flows';
import { ui } from '../uistate';
import { rerender } from '../app';

const C_REV = '#3a8744';
const C_EXP = '#e07a2e';
const C_NET = '#4fa556';
const C_CLI = '#2a7db8';
const C_REP = '#d99a00';

function shortDay(d: number): string {
  const c = calSafe(d);
  return `${c.season[0].toUpperCase()}${c.season.slice(1, 3)} ${c.dayOfSeason}`;
}

function charts(s: GameState): Raw {
  const days: DaySummary[] = (s.days || []).slice(ui.businessRange > 0 ? -ui.businessRange : 0);
  if (days.length < 2) return emptyState('chart', 'Charts start after a few days', 'End a couple of days to see revenue, clients and reputation over time.');
  const labels = days.map((d) => shortDay(d.day));
  const kmoney = (v: number) => (v < 0 ? '-' : '') + (Math.abs(v) >= 1000 ? `$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `$${Math.round(Math.abs(v))}`);
  const rev = days.reduce((a, d) => a + d.revenue, 0);
  const exp = days.reduce((a, d) => a + d.expenses, 0);
  return html`
  <div class="ui-seg" style="margin-bottom:16px">${[[14, '2 weeks'], [28, '4 weeks'], [56, '8 weeks'], [0, 'All']].map(([v, l]) => html`<button class="${ui.businessRange === v ? 'is-on' : ''}" data-click="range" data-v="${v}">${l}</button>`)}</div>
  <div class="ui-grid ui-grid--2">
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('cash'))}Revenue and expenses</span><span class="ui-small ui-muted">${money(rev)} in, ${money(exp)} out</span></div>
      ${chartSlot({ kind: 'line', labels, fmt: kmoney, series: [{ name: 'Revenue', color: C_REV, values: days.map((d) => d.revenue) }, { name: 'Expenses', color: C_EXP, values: days.map((d) => Math.abs(d.expenses)) }] }, 'Revenue and expenses per day')}
    </div>
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('trend'))}Net per day</span><span class="ui-small ${rev - exp >= 0 ? 'ui-good' : 'ui-bad'} ui-strong">${money(rev - Math.abs(exp))}</span></div>
      ${chartSlot({ kind: 'bars', labels, fmt: kmoney, series: [{ name: 'Net', color: C_NET, values: days.map((d) => d.net) }] }, 'Net profit per day')}
    </div>
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('house'))}Clients</span><span class="ui-small ui-muted">${days[days.length - 1].clients} now</span></div>
      ${chartSlot({ kind: 'line', labels, fmt: (v) => String(Math.round(v)), yMin: 0, series: [{ name: 'Clients', color: C_CLI, values: days.map((d) => d.clients) }] }, 'Clients over time')}
    </div>
    <div class="ui-card ui-card--flat">
      <div class="ui-card__head"><span class="ui-card__title">${raw(icon('star'))}Reputation</span>${starsView(days[days.length - 1].rep, { tip: true })}</div>
      ${chartSlot({ kind: 'line', labels, fmt: (v) => v.toFixed(1), yMin: 1, yMax: 5, series: [{ name: 'Reputation', color: C_REP, values: days.map((d) => d.rep) }] }, 'Reputation over time')}
    </div>
  </div>`;
}

function valuationCard(s: GameState): Raw {
  const v = safe(() => sim.valuation(s), null, 'valuation');
  if (!v) return html`<div class="ui-card"><div class="ui-card__title">${raw(icon('briefcase'))}Company value</div><p class="ui-muted" style="margin-top:8px">A valuation needs a few weeks of history.</p></div>`;
  const pts = sim.legacyPointsFor(v.total);
  return html`<div class="ui-card ui-card--dark ui-val">
    <div class="ui-row"><span class="ui-card__title" style="color:#fff">${raw(icon('briefcase'))}Company value</span></div>
    <div class="ui-val__total">${money(v.total)}</div>
    <div class="ui-small" style="opacity:.8">Worth ${pts} legacy point${pts === 1 ? '' : 's'} if sold today</div>
    <dl class="ui-kv ui-val__kv">
      <dt>Annual profit pace</dt><dd>${money(v.annualProfit)}</dd>
      <dt>Multiple</dt><dd>${v.multiple.toFixed(2)}x</dd>
      <dt>Client retention</dt><dd>${Math.round(v.retention * 100)}%</dd>
      <dt>Equipment book value</dt><dd>${money(v.bookValue)}</dd>
      <dt>Cash</dt><dd>${money(v.cash)}</dd>
      <dt>Debt</dt><dd>${money(-Math.abs(v.debt))}</dd>
    </dl>
  </div>`;
}

function stats(s: GameState): Raw {
  const st = s.stats || ({} as GameState['stats']);
  const tiles: [string, string, string][] = [
    ['mower', 'Jobs done', String(st.jobs || 0)],
    ['user', 'Mowed by you', String(st.manualJobs || 0)],
    ['cash', 'Lifetime revenue', money(st.revenue || 0)],
    ['star', 'Best quality', st.bestQ ? String(Math.round(st.bestQ)) : '-'],
    ['sparkle', 'Near-perfect jobs', String(st.perfectJobs || 0)],
    ['handshake', 'Deals signed', String(st.deals || 0)],
    ['door', 'Doors knocked', String(st.knocks || 0)],
    ['grass', 'Lawn mowed', sqft(st.m2Mowed || 0)],
    ['house', 'Peak clients', String(st.peakClients || 0)],
    ['alert', 'Damages', String(st.damages || 0)],
  ];
  return html`<div class="ui-grid ui-grid--auto-sm">${tiles.map(([ic, l, v]) => html`<div class="ui-stat"><div class="ui-stat__label">${raw(icon(ic))}${l}</div><div class="ui-stat__value" style="font-size:24px">${v}</div></div>`)}</div>`;
}

function achievements(s: GameState): Raw {
  const list = safe(() => sim.ACHIEVEMENTS, []);
  const got = new Set(s.achievements || []);
  if (!list.length) return emptyState('trophy', 'Achievements', 'Milestones appear here as you play.');
  return html`
  <p class="ui-muted ui-strong" style="margin-bottom:14px">${got.size} of ${list.length} unlocked</p>
  <div class="ui-ach-grid">${list.map((a) => html`<div class="ui-ach ${got.has(a.id) ? 'is-on' : ''}">
    <span class="ui-ach__ic">${raw(icon(got.has(a.id) ? 'trophy' : 'lock'))}</span>
    <div><b>${a.name}</b><div class="ui-tiny ui-muted">${a.blurb}</div></div>
  </div>`)}</div>`;
}

function sell(s: GameState): Raw {
  const can = safe(() => sim.canSellCompany(s), { ok: false, message: 'Selling opens after the first year.' });
  const v = safe(() => sim.valuation(s), null);
  const pts = v ? sim.legacyPointsFor(v.total) : 0;
  const perks = safe(() => sim.LEGACY_PERKS, []);
  return html`<div class="ui-grid ui-grid--2">
    ${valuationCard(s)}
    <div class="ui-card ui-card--sun">
      <div class="ui-card__title">${raw(icon('crown'))}Sell and start again</div>
      <p class="ui-muted ui-strong" style="margin:8px 0 12px">Sell the company for legacy points (square root of the value over $20,000). Spend them on perks that carry into every new company.</p>
      <div class="ui-row" style="gap:12px;margin-bottom:14px"><span class="ui-stat__value">+${pts}</span><span class="ui-muted ui-strong">legacy point${pts === 1 ? '' : 's'} today${s.legacy?.points ? `, ${s.legacy.points} banked` : ''}</span></div>
      ${perks.length ? html`<div class="ui-col" style="gap:6px;margin-bottom:16px">${perks.map((p) => html`<div class="ui-row ui-small"><span class="ui-chip ui-chip--dark">${p.cost} pt</span><b>${p.name}</b><span class="ui-muted">${p.blurb}</span></div>`)}</div>` : ''}
      <button class="ui-btn ${can.ok ? 'ui-btn--danger' : ''}" data-click="sell" ${can.ok ? '' : raw('disabled')}>${raw(icon('sell'))}Sell the company</button>
      ${!can.ok ? html`<p class="ui-small ui-muted" style="margin-top:8px">${can.message}</p>` : ''}
    </div>
  </div>`;
}

function render(): Raw {
  const s = store.state;
  const tab = ui.businessTab;
  const v = safe(() => sim.valuation(s), null);
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Business</h1><p>${s.company.name.replace(/\.$/, '')}${v ? `. Valued at ${money(v.total)}.` : '.'}</p></div>
  </div>
  <div class="ui-tabs-bar" role="tablist">
    <button class="ui-tab ${tab === 'charts' ? 'is-on' : ''}" data-click="tab" data-id="charts">${raw(icon('chart'))}Performance</button>
    <button class="ui-tab ${tab === 'achievements' ? 'is-on' : ''}" data-click="tab" data-id="achievements">${raw(icon('trophy'))}Achievements<span class="ui-count">${(s.achievements || []).length}</span></button>
    <button class="ui-tab ${tab === 'sell' ? 'is-on' : ''}" data-click="tab" data-id="sell">${raw(icon('briefcase'))}Value and legacy</button>
  </div>
  ${tab === 'charts' ? html`${charts(s)}<h2 class="ui-section-title">${raw(icon('book'))}Stats</h2>${stats(s)}` : tab === 'achievements' ? achievements(s) : sell(s)}
  `;
}

export const businessScreen: Screen = {
  id: 'business',
  render,
  after(root) {
    drawCharts(root);
    bindChartResize(() => document.getElementById('ui-main'));
  },
  handlers: {
    tab: (el) => { ui.businessTab = (el.dataset.id as typeof ui.businessTab) || 'charts'; rerender(); },
    range: (el) => { ui.businessRange = Number(el.dataset.v) || 0; rerender(); },
    sell: () => { void sellCompanyFlow(); },
  },
};
