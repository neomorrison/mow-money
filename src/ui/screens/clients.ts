// Clients: list with filters and sort, detail drawer with price, service, yard sign and drop.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, sqft } from '../../core/format';
import { ARCHETYPES } from '../../data/archetypes';
import type { AddOn, Client, GameState, HouseInfo } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import {
  safe, act, calSafe, avatar, bar, satColor, satLabel, riskChip, sparkline, emptyState, freqLabel, qColor, hoodName, plural, WEEKDAYS_LONG,
} from '../kit';
import { confirmDialog, openModal, type ModalHandle } from '../overlay';
import { startMow } from '../flows';
import { ui } from '../uistate';
import { rerender } from '../app';

const ARCH: Record<string, { label: string; flavor: string }> = Object.fromEntries(ARCHETYPES.map((a) => [a.id, { label: a.label, flavor: a.flavor }]));
const ADDONS: { id: AddOn; label: string; pct: number; blurb: string; icon: string }[] = [
  { id: 'bagging', label: 'Bagging', pct: 12, blurb: 'Clippings collected', icon: 'bag' },
  { id: 'stripes', label: 'Premium stripes', pct: 10, blurb: 'Bigger stripe bonus. They notice when there are no stripes', icon: 'stripes' },
  { id: 'fertilizer', label: 'Fertilizer program', pct: 8, blurb: 'Faster growth, happier gardeners', icon: 'leaf' },
];

interface Row { c: Client; info: HouseInfo | null; risk: number; name: string; hood: string }

function rows(s: GameState): Row[] {
  return s.clients.map((c) => {
    const info = safe(() => sim.houseInfo(s, c.houseId), null, 'houseInfo');
    const risk = safe(() => sim.churnRiskWeekly(s, c), 0, 'churnRisk');
    const hoodKey = info ? `${info.townId}.${info.hoodId}` : c.houseId.split('.').slice(0, 2).join('.');
    return { c, info, risk, name: info?.ownerName || 'Client', hood: hoodKey };
  });
}

function dueText(c: Client, day: number): Raw {
  if (c.status === 'paused') return html`<span class="ui-chip ui-chip--grey">Paused</span>`;
  const d = c.nextDueDay - day;
  if (d < -1) return html`<span class="ui-chip ui-chip--red">${-d - 1 === 1 ? '1 day late' : `${-d - 1} days late`}</span>`;
  if (d <= 0) return html`<span class="ui-chip ui-chip--sky">Due today</span>`;
  if (d === 1) return html`<span class="ui-chip ui-chip--grey">Tomorrow</span>`;
  return html`<span class="ui-chip ui-chip--grey">${d < 7 ? WEEKDAYS_LONG[calSafe(c.nextDueDay).weekday] : `In ${d} days`}</span>`;
}

function clientRow(r: Row, s: GameState): Raw {
  const c = r.c;
  return html`
  <button class="ui-client" data-click="open" data-id="${c.id}">
    ${avatar(r.info?.portrait, r.name, 48)}
    <span class="ui-client__who">
      <b>${r.name}</b>
      <small>${r.info?.address || ''} · ${hoodName(r.hood)}</small>
    </span>
    <span class="ui-client__sat">
      <span class="ui-row" style="justify-content:space-between;gap:6px"><small style="color:${satColor(c.satisfaction)}">${satLabel(c.satisfaction)}</small><small class="ui-num ui-muted">${Math.round(c.satisfaction)}</small></span>
      ${bar(c.satisfaction / 100, { color: satColor(c.satisfaction), cls: 'ui-bar--thin' })}
    </span>
    <span class="ui-client__risk">${riskChip(r.risk)}</span>
    <span class="ui-client__price"><b>${money(c.price)}</b><small>${freqLabel(c.freq)}</small></span>
    <span class="ui-client__q" data-tip="Last quality score">${c.lastQ >= 0 ? html`<b style="color:${qColor(c.lastQ)}">${Math.round(c.lastQ)}</b>` : html`<b class="ui-faint">-</b>`}<small>last Q</small></span>
    <span class="ui-client__spark">${sparkline(c.history || [], { w: 84, h: 28, min: 0, max: 100, color: satColor(c.satisfaction) })}</span>
    <span class="ui-client__due">${dueText(c, s.day)}${c.trial ? html` <span class="ui-chip ui-chip--sun">Trial</span>` : ''}</span>
    <span class="ui-client__go">${raw(icon('chevR'))}</span>
  </button>`;
}

function render(): Raw {
  const s = store.state;
  const all = rows(s);
  const hoods = [...new Set(all.map((r) => r.hood))];
  if (ui.clientsFilterHood !== 'all' && !hoods.includes(ui.clientsFilterHood)) ui.clientsFilterHood = 'all';
  let list = ui.clientsFilterHood === 'all' ? all : all.filter((r) => r.hood === ui.clientsFilterHood);
  const sorters: Record<string, (a: Row, b: Row) => number> = {
    due: (a, b) => a.c.nextDueDay - b.c.nextDueDay,
    satisfaction: (a, b) => a.c.satisfaction - b.c.satisfaction,
    risk: (a, b) => b.risk - a.risk,
    price: (a, b) => b.c.price - a.c.price,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list = [...list].sort(sorters[ui.clientsSort] || sorters.due);
  const active = s.clients.filter((c) => c.status === 'active');
  const weekly = active.reduce((a, c) => a + c.price * (7 / c.freq), 0);
  const avgSat = active.length ? active.reduce((a, c) => a + c.satisfaction, 0) / active.length : 0;
  const atRisk = all.filter((r) => r.risk >= 0.08).length;
  const lost = (s.lost || []).slice(-6).reverse();

  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Clients</h1><p>${plural(active.length, 'active client')}${s.clients.length - active.length ? `, ${s.clients.length - active.length} paused` : ''}.</p></div>
  </div>
  <div class="ui-grid ui-grid--4" style="margin-bottom:20px">
    <div class="ui-stat"><div class="ui-stat__label">${raw(icon('cash'))}Weekly revenue</div><div class="ui-stat__value">${money(weekly)}</div></div>
    <div class="ui-stat"><div class="ui-stat__label">${raw(icon('smile'))}Avg satisfaction</div><div class="ui-stat__value" style="color:${satColor(avgSat)}">${active.length ? Math.round(avgSat) : '-'}</div><div class="ui-stat__sub">${active.length ? satLabel(avgSat) : 'No clients yet'}</div></div>
    <div class="ui-stat ${atRisk ? 'ui-stat--bad' : ''}"><div class="ui-stat__label">${raw(icon('alert'))}At risk</div><div class="ui-stat__value">${atRisk}</div><div class="ui-stat__sub">8%+ weekly risk</div></div>
    <div class="ui-stat"><div class="ui-stat__label">${raw(icon('heart'))}Peak</div><div class="ui-stat__value">${s.stats?.peakClients ?? active.length}</div><div class="ui-stat__sub">most clients at once</div></div>
  </div>
  ${s.clients.length ? html`
  <div class="ui-toolbar">
    <label class="ui-field ui-toolbar__f"><span class="ui-label">${raw(icon('filter'))} Neighborhood</span>
      <select class="ui-select ui-select--sm" data-change="hood">
        <option value="all">All neighborhoods</option>
        ${hoods.map((h) => html`<option value="${h}" ${ui.clientsFilterHood === h ? raw('selected') : ''}>${hoodName(h)}</option>`)}
      </select>
    </label>
    <label class="ui-field ui-toolbar__f"><span class="ui-label">${raw(icon('sort'))} Sort</span>
      <select class="ui-select ui-select--sm" data-change="sort">
        ${[['due', 'Next due'], ['satisfaction', 'Lowest satisfaction'], ['risk', 'Highest risk'], ['price', 'Highest price'], ['name', 'Name']].map(([v, l]) => html`<option value="${v}" ${ui.clientsSort === v ? raw('selected') : ''}>${l}</option>`)}
      </select>
    </label>
  </div>
  <div class="ui-clients">${list.map((r) => clientRow(r, s))}</div>`
  : emptyState('house', 'No clients yet', 'Knock on doors to sign your first lawn.', html`<button class="ui-btn ui-btn--go" data-click="map">${raw(icon('map'))}Open the map</button>`)}
  ${lost.length ? html`
    <h2 class="ui-section-title">${raw(icon('frown'))}Recently lost</h2>
    <div class="ui-lost">${lost.map((l) => {
      const info = safe(() => sim.houseInfo(s, l.houseId), null);
      return html`<div class="ui-lost__row">${avatar(info?.portrait, info?.ownerName || 'Client', 36)}<div class="ui-grow"><b>${info?.ownerName || 'Former client'}</b><div class="ui-tiny ui-muted">${info?.address || ''} · ${calSafe(l.day).label}</div></div><span class="ui-small ui-bad ui-strong">${l.reason}</span></div>`;
    })}</div>` : ''}
  `;
}

// ---------------------------------------------------------------- drawer
let drawer: ModalHandle | null = null;
let draftPrice: Record<string, string> = {};

function drawerBody(id: string): Raw {
  const s = store.state;
  const c = s.clients.find((x) => x.id === id);
  if (!c) return html`<p class="ui-muted">This client is no longer with you.</p>`;
  const info = safe(() => sim.houseInfo(s, c.houseId), null);
  const hs = s.houses?.[c.houseId];
  const risk = safe(() => sim.churnRiskWeekly(s, c), 0);
  const arch = info ? ARCH[info.archetypeId] : undefined;
  const hoodKey = info ? `${info.townId}.${info.hoodId}` : '';
  const kind = safe(() => sim.hoods(s).find((h) => h.key === hoodKey)?.spec.kind, undefined) || 'residential';
  const fair = info ? safe(() => sim.fairPrice(info.lawnM2, c.freq, kind), 0) : 0;
  const addPct = c.addOns.reduce((a, id) => a + (ADDONS.find((x) => x.id === id)?.pct || 0), 0);
  const draft = draftPrice[c.id] ?? String(Math.round(c.price));
  const hist = c.history || [];
  return html`
  <div class="ui-drawer__head">
    ${avatar(info?.portrait, info?.ownerName || 'Client', 76)}
    <div class="ui-grow" style="min-width:0">
      <h2 style="font-size:26px">${info?.ownerName || 'Client'}</h2>
      <div class="ui-muted ui-strong ui-small">${info?.address || ''} · ${hoodName(hoodKey)}</div>
      ${arch ? html`<div class="ui-chip ui-chip--sky" style="margin-top:6px">${arch.label}</div>` : ''}
    </div>
  </div>
  ${arch ? html`<p class="ui-small ui-muted" style="margin:10px 0 0;font-style:italic">${arch.flavor}</p>` : ''}

  <div class="ui-card ui-card--flat" style="margin-top:16px">
    <div class="ui-row" style="justify-content:space-between;margin-bottom:6px">
      <span class="ui-strong" style="color:${satColor(c.satisfaction)};font-size:18px">${satLabel(c.satisfaction)} <span class="ui-num">${Math.round(c.satisfaction)}</span></span>
      ${riskChip(risk)}
    </div>
    ${bar(c.satisfaction / 100, { color: satColor(c.satisfaction), cls: 'ui-bar--thick' })}
    <div class="ui-row" style="margin-top:14px;gap:14px;align-items:flex-end">
      <div class="ui-grow">
        <div class="ui-label">Quality history</div>
        ${sparkline(hist, { w: 240, h: 54, min: 0, max: 100, color: 'var(--ui-g-600)' })}
      </div>
      <div style="text-align:right"><div class="ui-label">Last Q</div><div style="font-family:var(--ui-font-display);font-size:30px;font-weight:800;color:${c.lastQ >= 0 ? qColor(c.lastQ) : 'var(--ui-ink-3)'}">${c.lastQ >= 0 ? Math.round(c.lastQ) : '-'}</div></div>
    </div>
  </div>

  <dl class="ui-kv" style="margin:16px 0">
    <dt>Lawn</dt><dd>${info ? sqft(info.lawnM2) : '-'}</dd>
    <dt>Client since</dt><dd>${calSafe(c.since).label}</dd>
    <dt>Next due</dt><dd>${c.status === 'paused' ? 'Paused' : calSafe(c.nextDueDay).label}</dd>
    <dt>Visits</dt><dd>${c.visits}</dd>
    <dt>Paid to date</dt><dd>${money(c.totalPaid)}</dd>
    <dt>Tips</dt><dd>${money(c.tips)}</dd>
    ${c.damages ? html`<dt>Damage incidents</dt><dd class="ui-bad">${c.damages}</dd>` : ''}
    ${c.bestManualQ >= 0 ? html`<dt>Your best here</dt><dd>${Math.round(c.bestManualQ)}</dd>` : ''}
    ${c.commercial ? html`<dt>Contract</dt><dd>${plural(c.commercial.weeksLeft, 'week')} left</dd>` : ''}
  </dl>

  <div class="ui-drawer__sec">
    <div class="ui-label">Price per mow</div>
    <div class="ui-row" style="margin-top:6px">
      <div class="ui-money-input ui-grow"><input class="ui-input" type="number" min="5" step="1" inputmode="numeric" value="${draft}" data-input="price" data-id="${c.id}" aria-label="New price"></div>
      <button class="ui-btn ui-btn--primary" data-click="setPrice" data-id="${c.id}">Set price</button>
    </div>
    <p class="ui-tiny ui-muted" style="margin-top:6px">Now ${money(c.price)}${addPct ? ` incl. ${addPct}% add-ons` : ''}. ${fair ? `Market rate for this lawn: about ${money(fair * (1 + addPct / 100))}.` : ''} Charging more than they value the service costs satisfaction every week.</p>
  </div>

  <div class="ui-drawer__sec">
    <div class="ui-label">Frequency</div>
    <div class="ui-seg" style="margin-top:6px">
      <button class="${c.freq === 7 ? 'is-on' : ''}" data-click="freq" data-id="${c.id}" data-f="7">Weekly</button>
      <button class="${c.freq === 14 ? 'is-on' : ''}" data-click="freq" data-id="${c.id}" data-f="14">Every 2 weeks</button>
    </div>
  </div>

  <div class="ui-drawer__sec">
    <div class="ui-label">Add-ons</div>
    <div class="ui-col" style="margin-top:6px;gap:4px">
      ${ADDONS.map((a) => html`<label class="ui-toggle ui-addon">
        <input type="checkbox" ${c.addOns.includes(a.id) ? raw('checked') : ''} data-change="addon" data-id="${c.id}" data-a="${a.id}">
        <span class="ui-toggle__track"></span>
        <span class="ui-grow"><b>${a.label}</b> <span class="ui-chip ui-chip--grey">+${a.pct}%</span><br><span class="ui-tiny ui-muted">${a.blurb}</span></span>
      </label>`)}
    </div>
  </div>

  <div class="ui-drawer__sec">
    <div class="ui-label">Assigned to</div>
    <select class="ui-select" style="margin-top:6px" data-change="assign" data-id="${c.id}">
      <option value="owner" ${c.assignee === 'owner' ? raw('selected') : ''}>You</option>
      ${s.crews.map((cr) => html`<option value="${cr.id}" ${c.assignee === cr.id ? raw('selected') : ''}>${cr.name}</option>`)}
    </select>
  </div>

  <div class="ui-row ui-row--wrap" style="gap:10px;margin-top:18px">
    ${c.assignee === 'owner' && c.status === 'active' ? html`<button class="ui-btn ui-btn--go" data-click="mow" data-id="${c.id}">${raw(icon('mower'))}Mow now</button>` : ''}
    ${hs?.yardSign ? html`<span class="ui-chip ui-chip--sun" style="min-height:44px;padding:0 14px">${raw(icon('sign'))}Yard sign up</span>` : html`<button class="ui-btn" data-click="sign" data-id="${c.id}" data-tip="Happy clients often say yes. Signs bring more leads on their street.">${raw(icon('sign'))}Ask for a yard sign</button>`}
    ${info ? html`<button class="ui-btn ui-btn--ghost" data-click="hood" data-key="${hoodKey}">${raw(icon('map'))}Map</button>` : ''}
  </div>
  <hr class="ui-divider" style="margin-top:22px">
  <button class="ui-btn ui-btn--ghost ui-bad" data-click="drop" data-id="${c.id}">${raw(icon('trash'))}Drop client</button>
  `;
}

const drawerHandlers = {
  price: (el: HTMLElement) => { draftPrice[el.dataset.id || ''] = (el as HTMLInputElement).value; },
  setPrice: (el: HTMLElement) => {
    const id = el.dataset.id || '';
    const v = Math.round(Number(draftPrice[id]));
    if (!Number.isFinite(v) || v <= 0) return;
    act(() => sim.changePrice(store.state, id, v));
    delete draftPrice[id];
    refreshDrawer();
  },
  freq: (el: HTMLElement) => {
    const f = Number(el.dataset.f) === 14 ? 14 : 7;
    act(() => sim.changeService(store.state, el.dataset.id || '', { freq: f }));
    refreshDrawer();
  },
  addon: (el: HTMLElement) => {
    const s = store.state;
    const c = s.clients.find((x) => x.id === el.dataset.id);
    if (!c) return;
    const a = el.dataset.a as AddOn;
    const on = (el as HTMLInputElement).checked;
    const next = on ? [...new Set([...c.addOns, a])] : c.addOns.filter((x) => x !== a);
    act(() => sim.changeService(s, c.id, { addOns: next }));
    refreshDrawer();
  },
  assign: (el: HTMLElement) => {
    act(() => sim.assignJob(store.state, el.dataset.id || '', (el as HTMLSelectElement).value), { quietOk: true });
    refreshDrawer();
  },
  sign: (el: HTMLElement) => { act(() => sim.askForYardSign(store.state, el.dataset.id || '')); refreshDrawer(); },
  mow: (el: HTMLElement) => { drawer?.close(); startMow(el.dataset.id || null); },
  hood: (el: HTMLElement) => { drawer?.close(); navigate('hood', el.dataset.key || ''); },
  drop: async (el: HTMLElement) => {
    const id = el.dataset.id || '';
    const s = store.state;
    const c = s.clients.find((x) => x.id === id);
    const info = c ? safe(() => sim.houseInfo(s, c.houseId), null) : null;
    const ok = await confirmDialog({
      title: `Drop ${info?.ownerName || 'this client'}?`,
      body: 'They will find another service. You can pitch them again later, but they will remember.',
      ok: 'Drop client',
      danger: true,
    });
    if (!ok) return;
    if (act(() => sim.dropClient(store.state, id))) drawer?.close();
  },
};

function refreshDrawer(): void {
  if (drawer && ui.openClientId) drawer.setBody(drawerBody(ui.openClientId));
}

function openDrawer(id: string): void {
  ui.openClientId = id;
  draftPrice = {};
  drawer = openModal({
    drawer: true,
    body: drawerBody(id),
    handlers: drawerHandlers,
    onClose: () => { drawer = null; ui.openClientId = null; },
  });
}

export const clientsScreen: Screen = {
  id: 'clients',
  render,
  handlers: {
    open: (el) => openDrawer(el.dataset.id || ''),
    hood: (el) => { ui.clientsFilterHood = (el as HTMLSelectElement).value; rerender(); },
    sort: (el) => { ui.clientsSort = (el as HTMLSelectElement).value as typeof ui.clientsSort; rerender(); },
    map: () => navigate('map'),
  },
  after() { refreshDrawer(); },
  unmount() { drawer?.close(); },
};
