// Garage: shop by category with comparison bars, owned gear with maintenance, owner kit summary.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money } from '../../core/format';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../../data/equipment';
import type { EquipmentCategory, EquipmentSpec, GameState, OwnedItem, ShopEntry } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { safe, act, bar, thumb, CAT_LABEL, CAT_ICON, emptyState, clamp, equipIcon } from '../kit';
import { confirmDialog } from '../overlay';
import { ui } from '../uistate';
import { rerender } from '../app';

const TABS: (EquipmentCategory | 'owned')[] = ['mower', 'trimmer', 'blower', 'vehicle', 'addon', 'owned'];
const TIME_SCALE = 0.2;

interface Stat { label: string; get: (s: EquipmentSpec) => number | undefined; max: number; min?: number; fmt: (v: number) => string }
const STATS: Record<EquipmentCategory, Stat[]> = {
  mower: [
    { label: 'Deck width', get: (s) => s.deckWidth, max: 6, fmt: (v) => `${v.toFixed(1)} m` },
    { label: 'Speed', get: (s) => s.speed, max: 7, fmt: (v) => `${v.toFixed(1)} m/s` },
    { label: 'Productivity', get: (s) => (s.deckWidth && s.speed ? (s.deckWidth * s.speed * 0.75) / TIME_SCALE : undefined), max: 150, fmt: (v) => `${Math.round(v)} m2/min` },
    { label: 'Quality cap', get: (s) => s.qualityCap, min: 70, max: 100, fmt: (v) => `${Math.round(v)}` },
    { label: 'Stripes', get: (s) => s.stripe, max: 1, fmt: (v) => `${Math.round(v * 100)}%` },
    { label: 'Tall grass', get: (s) => s.maxGrassIn, max: 10, fmt: (v) => `${v.toFixed(1)} in` },
  ],
  trimmer: [
    { label: 'Reach', get: (s) => s.radius, max: 1, fmt: (v) => `${v.toFixed(2)} m` },
    { label: 'Speed', get: (s) => s.speed, max: 3, fmt: (v) => `${v.toFixed(1)} m/s` },
  ],
  blower: [
    { label: 'Reach', get: (s) => s.radius, max: 2.6, fmt: (v) => `${v.toFixed(1)} m` },
    { label: 'Speed', get: (s) => s.speed, max: 3, fmt: (v) => `${v.toFixed(1)} m/s` },
  ],
  vehicle: [
    { label: 'Travel speed', get: (s) => s.travelSpeedKmh, max: 50, fmt: (v) => `${Math.round(v)} km/h` },
    { label: 'Capacity', get: (s) => s.capacity, max: 14, fmt: (v) => `${v} units` },
    { label: 'Seats', get: (s) => s.seats, max: 4, fmt: (v) => `${v}` },
  ],
  addon: [],
};

function ownerSlot(s: GameState, cat: EquipmentCategory): OwnedItem | undefined {
  const uid = cat === 'mower' ? s.owner.mowerUid : cat === 'trimmer' ? s.owner.trimmerUid : cat === 'blower' ? s.owner.blowerUid : cat === 'vehicle' ? s.owner.vehicleUid : null;
  return uid ? s.items.find((i) => i.uid === uid) : undefined;
}

function statBars(spec: EquipmentSpec, cur: EquipmentSpec | undefined): Raw {
  const stats = STATS[spec.category] || [];
  return html`<div class="ui-cmp">${stats.map((st) => {
    const v = st.get(spec);
    if (v === undefined) return '';
    const c = cur ? st.get(cur) : undefined;
    const min = st.min ?? 0;
    const norm = (x: number) => clamp((x - min) / (st.max - min), 0, 1);
    const better = c !== undefined && v > c + 1e-6;
    const worse = c !== undefined && v < c - 1e-6;
    return html`<div class="ui-cmp__row">
      <span class="ui-cmp__label">${st.label}</span>
      ${bar(norm(v), { cls: 'ui-bar--thin', color: better ? 'var(--ui-g-500)' : worse ? 'var(--ui-orange)' : 'var(--ui-sky-500)', cmp: c !== undefined && cur?.id !== spec.id ? norm(c) : null })}
      <span class="ui-cmp__val ${better ? 'ui-good' : worse ? 'ui-warn' : ''}">${st.fmt(v)}</span>
    </div>`;
  })}</div>`;
}

function flags(spec: EquipmentSpec): Raw {
  const f: string[] = [];
  if (spec.rideOn) f.push('Ride-on');
  if (spec.zeroTurn) f.push('Zero-turn');
  if (spec.bagging) f.push('Bagger');
  if (spec.mulching) f.push('Mulching');
  if (spec.fuelGalPerHr === 0 && spec.category === 'mower') f.push('No fuel');
  if (spec.transportSize) f.push(`Haul size ${spec.transportSize}`);
  return html`${f.map((x) => html`<span class="ui-chip ui-chip--grey">${x}</span>`)}`;
}

function shopCard(e: ShopEntry, s: GameState): Raw {
  const cur = ownerSlot(s, e.spec.category);
  const curSpec = cur ? EQUIPMENT_BY_ID[cur.specId] : undefined;
  const locked = !e.canBuy && !!e.reason;
  const discounted = e.price < e.spec.price;
  return html`
  <article class="ui-shop ${locked ? 'is-locked' : ''}">
    <div class="ui-shop__top">
      ${thumb(e.spec, 108)}
      <div class="ui-grow" style="min-width:0">
        <div class="ui-row" style="gap:6px;align-items:flex-start">
          <h3 class="ui-shop__name ui-grow">${e.spec.name}</h3>
          ${e.owned ? html`<span class="ui-chip">${raw(icon('check'))}${e.owned > 1 ? `Own ${e.owned}` : 'Owned'}</span>` : ''}
        </div>
        <p class="ui-small ui-muted">${e.spec.blurb}</p>
        <div class="ui-row ui-row--wrap" style="gap:5px;margin-top:6px">${flags(e.spec)}</div>
      </div>
    </div>
    ${statBars(e.spec, curSpec)}
    ${curSpec && curSpec.id !== e.spec.id && STATS[e.spec.category]?.length ? html`<div class="ui-tiny ui-faint" style="margin-top:-4px">Marker: your ${curSpec.name}</div>` : ''}
    <div class="ui-shop__foot">
      <div class="ui-shop__price">${e.spec.price === 0 ? html`<b>Free</b>` : html`<b>${money(e.price)}</b>${discounted ? html`<s>${money(e.spec.price)}</s>` : ''}`}</div>
      <span class="ui-grow"></span>
      ${locked ? html`<span class="ui-chip ui-chip--grey ui-shop__lock">${raw(icon('lock'))}${e.reason}</span>`
        : html`<button class="ui-btn ${e.canBuy ? 'ui-btn--primary' : ''}" data-click="buy" data-id="${e.spec.id}" ${e.canBuy ? '' : raw('disabled')}>${raw(icon('cash'))}Buy</button>`}
    </div>
    ${!e.canBuy && !locked && e.price > s.cash ? html`<div class="ui-tiny ui-bad ui-strong" style="text-align:right">Need ${money(e.price - s.cash)} more</div>` : ''}
  </article>`;
}

function ownedCard(it: OwnedItem, s: GameState): Raw {
  const spec = EQUIPMENT_BY_ID[it.specId];
  if (!spec) return html``;
  const equipped = [s.owner.mowerUid, s.owner.trimmerUid, s.owner.blowerUid, s.owner.vehicleUid].includes(it.uid);
  const crew = it.crewId ? s.crews.find((c) => c.id === it.crewId) : null;
  const resale = safe(() => sim.resaleValue(s, it.uid), Math.round(it.paid * 0.8));
  const isMower = spec.category === 'mower';
  return html`
  <article class="ui-owned ${it.broken ? 'is-broken' : ''}">
    ${thumb(spec, 76)}
    <div class="ui-grow" style="min-width:0">
      <div class="ui-row ui-row--wrap" style="gap:6px"><b class="ui-owned__name">${spec.name}</b>
        ${equipped ? html`<span class="ui-chip">${raw(icon('user'))}Your kit</span>` : ''}
        ${crew ? html`<span class="ui-chip ui-chip--sky"><span class="ui-sw-dot" style="background:${crew.color}"></span>${crew.name}</span>` : ''}
        ${it.broken ? html`<span class="ui-chip ui-chip--red">${raw(icon('alert'))}Broken</span>` : ''}
      </div>
      <div class="ui-owned__bars">
        ${isMower ? html`<div class="ui-meter"><span class="ui-meter__label">Blade</span><span class="ui-meter__val">${Math.round(it.sharpness * 100)}%</span>${bar(it.sharpness, { cls: 'ui-bar--thin', color: it.sharpness < 0.5 ? 'var(--ui-orange)' : 'var(--ui-g-500)' })}</div>` : ''}
        ${spec.category !== 'addon' ? html`<div class="ui-meter"><span class="ui-meter__label">Condition</span><span class="ui-meter__val">${Math.round(it.condition * 100)}%</span>${bar(it.condition, { cls: 'ui-bar--thin', color: it.condition < 0.5 ? 'var(--ui-red)' : it.condition < 0.75 ? 'var(--ui-orange)' : 'var(--ui-sky-500)' })}</div>` : ''}
      </div>
      <div class="ui-tiny ui-muted">${it.hours ? `${it.hours.toFixed(1)} engine hours · ` : ''}paid ${money(it.paid)}</div>
      <div class="ui-row ui-row--wrap" style="gap:6px;margin-top:8px">
        ${spec.category !== 'addon' && !equipped && !it.crewId ? html`<button class="ui-btn ui-btn--sm ui-btn--go" data-click="equip" data-id="${it.uid}">${raw(icon('check'))}Equip</button>` : ''}
        ${isMower && it.sharpness < 0.98 ? html`<button class="ui-btn ui-btn--sm" data-click="sharpen" data-id="${it.uid}" data-tip="$6 and 15 minutes at HQ">${raw(icon('sharpen'))}Sharpen</button>` : ''}
        ${spec.category !== 'addon' && (it.broken || it.condition < 0.98) ? html`<button class="ui-btn ui-btn--sm" data-click="repair" data-id="${it.uid}">${raw(icon('wrench'))}Repair</button>` : ''}
        ${spec.price > 0 ? html`<button class="ui-btn ui-btn--sm ui-btn--ghost" data-click="sell" data-id="${it.uid}" data-v="${resale}">${raw(icon('sell'))}Sell ${money(resale)}</button>` : ''}
      </div>
    </div>
  </article>`;
}

function kitSummary(s: GameState): Raw {
  const slots: EquipmentCategory[] = ['mower', 'trimmer', 'blower', 'vehicle'];
  const addons = s.items.filter((i) => EQUIPMENT_BY_ID[i.specId]?.category === 'addon');
  return html`<div class="ui-kit">
    ${slots.map((cat) => {
      const it = ownerSlot(s, cat);
      const spec = it ? EQUIPMENT_BY_ID[it.specId] : undefined;
      return html`<div class="ui-kit__slot">
        <span class="ui-kit__ic">${raw(icon(spec ? equipIcon(spec) : CAT_ICON[cat]))}</span>
        <div class="ui-grow" style="min-width:0"><div class="ui-tiny ui-faint ui-strong" style="text-transform:uppercase;letter-spacing:.06em">${cat === 'vehicle' ? 'Ride' : cat}</div>
        <div class="ui-strong ui-kit__name">${spec?.name || 'None'}</div>
        ${it && cat === 'mower' ? bar(it.sharpness, { cls: 'ui-bar--thin', color: it.sharpness < 0.5 ? 'var(--ui-orange)' : 'var(--ui-g-500)', tip: `Blade ${Math.round(it.sharpness * 100)}%` }) : ''}
        </div>
      </div>`;
    })}
    ${addons.length ? html`<div class="ui-kit__slot"><span class="ui-kit__ic">${raw(icon('addon'))}</span><div class="ui-grow"><div class="ui-tiny ui-faint ui-strong" style="text-transform:uppercase;letter-spacing:.06em">Add-ons</div><div class="ui-strong ui-kit__name">${addons.map((a) => EQUIPMENT_BY_ID[a.specId]?.name).join(', ')}</div></div></div>` : ''}
  </div>`;
}

function fallbackShop(s: GameState): ShopEntry[] {
  return EQUIPMENT.map((spec) => ({ spec, price: spec.price, owned: s.items.filter((i) => i.specId === spec.id).length, canBuy: false, reason: '' }));
}

function render(): Raw {
  const s = store.state;
  const shop = safe(() => sim.shop(s), fallbackShop(s), 'shop');
  const tab = ui.garageTab;
  const list = tab === 'owned' ? [] : shop.filter((e) => e.spec.category === tab).sort((a, b) => a.spec.tier - b.spec.tier || a.spec.price - b.spec.price);
  const owned = [...s.items].sort((a, b) => {
    const ca = TABS.indexOf(EQUIPMENT_BY_ID[a.specId]?.category || 'addon');
    const cb = TABS.indexOf(EQUIPMENT_BY_ID[b.specId]?.category || 'addon');
    return ca - cb;
  });
  const needsCare = s.items.filter((i) => i.broken || i.sharpness < 0.5 || i.condition < 0.5).length;
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Garage</h1><p>Better gear mows faster and cleaner.</p></div>
  </div>
  ${kitSummary(s)}
  <div class="ui-tabs-bar" role="tablist" style="margin-top:20px">
    ${TABS.map((t) => html`<button class="ui-tab ${tab === t ? 'is-on' : ''}" data-click="tab" data-id="${t}" role="tab">${raw(icon(t === 'owned' ? 'wrench' : CAT_ICON[t]))}${t === 'owned' ? 'My gear' : CAT_LABEL[t]}${t === 'owned' ? html`<span class="ui-count">${s.items.length}</span>` : ''}${t === 'owned' && needsCare ? html`<span class="ui-badge-num">${needsCare}</span>` : ''}</button>`)}
  </div>
  ${tab === 'owned'
    ? owned.length ? html`<div class="ui-owned-list">${owned.map((i) => ownedCard(i, s))}</div>` : emptyState('mower', 'No gear yet')
    : html`<div class="ui-shop-grid">${list.map((e) => shopCard(e, s))}</div>`}
  `;
}

export const garageScreen: Screen = {
  id: 'garage',
  render,
  handlers: {
    tab: (el) => { ui.garageTab = (el.dataset.id as typeof ui.garageTab) || 'mower'; rerender(); },
    buy: async (el) => {
      const id = el.dataset.id || '';
      const e = safe(() => sim.shop(store.state), []).find((x) => x.spec.id === id);
      if (e && e.price >= 1000) {
        const ok = await confirmDialog({ title: `Buy ${e.spec.name}?`, body: `${money(e.price)} from ${money(store.state.cash)} cash.`, ok: `Buy for ${money(e.price)}` });
        if (!ok) return;
      }
      act(() => sim.buy(store.state, id), { sound: 'cash' });
    },
    equip: (el) => act(() => sim.equipOwner(store.state, el.dataset.id || '')),
    sharpen: (el) => act(() => sim.sharpen(store.state, el.dataset.id || '')),
    repair: (el) => act(() => sim.repair(store.state, el.dataset.id || ''), { sound: 'cash' }),
    sell: async (el) => {
      const s = store.state;
      const it = s.items.find((i) => i.uid === el.dataset.id);
      const spec = it ? EQUIPMENT_BY_ID[it.specId] : undefined;
      const ok = await confirmDialog({ title: `Sell ${spec?.name || 'this item'}?`, body: `A buyer pays ${money(Number(el.dataset.v) || 0)}.`, ok: 'Sell', danger: true });
      if (ok) act(() => sim.sell(s, el.dataset.id || ''), { sound: 'cash' });
    },
  },
};
