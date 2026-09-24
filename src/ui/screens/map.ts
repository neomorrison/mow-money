// Map: towns and neighborhoods. Opening a neighborhood mounts the pitch module full-bleed.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, duration, sqft } from '../../core/format';
import { mountNeighborhood, type NeighborhoodHandle } from '../../pitch';
import { HOODS, TOWNS } from '../../data/hoods';
import type { HoodView, TownView } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate, routeHash } from '../router';
import { safe, act, plural } from '../kit';
import { confirmDialog, toast } from '../overlay';
import { startMow } from '../flows';
import { ui } from '../uistate';
import { rerender } from '../app';

const KIND_ICON: Record<string, string> = { residential: 'house', estate: 'home', commercial: 'briefcase', park: 'flag', golf: 'target' };
const KIND_LABEL: Record<string, string> = { residential: 'Homes', estate: 'Estates', commercial: 'Commercial', park: 'Parks', golf: 'Golf' };
// Illustration palette per neighborhood template
const HOOD_ART: Record<string, [string, string, string]> = {
  maple: ['#bfe6a6', '#7fc36a', '#e8834a'],
  oak: ['#b4e0a0', '#6bb35c', '#b86b3c'],
  willow: ['#c6ebb8', '#5fae62', '#8ab4d8'],
  heritage: ['#d6efc2', '#4f9a4a', '#c9a45a'],
  pinecrest: ['#cfe6d6', '#6aa77a', '#8095a8'],
  parks: ['#c5ecb0', '#58b04f', '#e6c35a'],
  links: ['#bff0b0', '#3fa84a', '#f2f2f2'],
};

function hoodArt(id: string, kind: string): Raw {
  const [sky, grass, accent] = HOOD_ART[id] || HOOD_ART.maple;
  // Tiny SVG vignette: rolling lawn with mowing stripes and a few buildings
  const houses = kind === 'residential' || kind === 'estate';
  const n = kind === 'estate' ? 2 : kind === 'residential' ? 3 : 1;
  const bld: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = 40 + i * (220 / Math.max(1, n));
    const w = kind === 'estate' ? 70 : kind === 'commercial' ? 110 : 46;
    const h = kind === 'estate' ? 40 : kind === 'commercial' ? 44 : 30;
    const y = 58 - h;
    if (houses) {
      bld.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#fffaf0" stroke="#e7dcc3"/>`);
      bld.push(`<path d="M${x - 6} ${y + 2} L${x + w / 2} ${y - 18} L${x + w + 6} ${y + 2} Z" fill="${accent}"/>`);
      bld.push(`<rect x="${x + w / 2 - 6}" y="${y + h - 16}" width="12" height="16" rx="2" fill="#7a5238"/>`);
      bld.push(`<circle cx="${x + w + 20}" cy="${y + 8}" r="14" fill="${grass}" opacity=".9"/><rect x="${x + w + 18}" y="${y + 18}" width="4" height="12" fill="#7a5238"/>`);
    } else if (kind === 'commercial') {
      bld.push(`<rect x="${x + 40}" y="${y}" width="${w}" height="${h}" rx="3" fill="${accent}"/>`);
      for (let k = 0; k < 4; k++) bld.push(`<rect x="${x + 50 + k * 24}" y="${y + 8}" width="14" height="10" fill="#dff1ff"/><rect x="${x + 50 + k * 24}" y="${y + 24}" width="14" height="10" fill="#dff1ff"/>`);
    } else if (kind === 'park') {
      bld.push(`<path d="M120 56 L160 28 L200 56 Z" fill="${accent}"/><rect x="128" y="44" width="4" height="14" fill="#7a5238"/><rect x="188" y="44" width="4" height="14" fill="#7a5238"/>`);
      bld.push(`<circle cx="60" cy="40" r="16" fill="${grass}"/><circle cx="260" cy="38" r="18" fill="${grass}"/>`);
    } else {
      bld.push(`<path d="M230 58 V20" stroke="#6d4c33" stroke-width="2"/><path d="M230 20 l18 6 -18 6z" fill="#d9483b"/><ellipse cx="120" cy="62" rx="60" ry="10" fill="#e8d7a0"/>`);
    }
  }
  return raw(`<svg viewBox="0 0 320 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="320" height="100" fill="${sky}"/>
    <ellipse cx="80" cy="70" rx="160" ry="30" fill="${grass}" opacity=".55"/>
    <rect y="56" width="320" height="44" fill="${grass}"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 40}" y="56" width="20" height="44" fill="#fff" opacity=".09"/>`).join('')}
    ${bld.join('')}
  </svg>`);
}

function unlockHint(h: HoodView): string {
  return h.lockReason || 'Locked';
}

function hoodCard(h: HoodView): Raw {
  const spec = h.spec;
  const lawn = `${sqft(spec.lawnM2[0])}${spec.lawnM2[1] !== spec.lawnM2[0] ? ` to ${sqft(spec.lawnM2[1])}` : ''}`;
  const fair = safe(() => sim.fairPrice((spec.lawnM2[0] + spec.lawnM2[1]) / 2, 7, spec.kind), 0);
  return html`
  <article class="ui-hood ${h.unlocked ? '' : 'is-locked'}">
    <div class="ui-hood__art">${hoodArt(spec.id, spec.kind)}
      <span class="ui-chip ui-chip--dark ui-hood__kind">${raw(icon(KIND_ICON[spec.kind] || 'house'))}${KIND_LABEL[spec.kind] || spec.kind}</span>
      ${h.unlocked ? '' : html`<span class="ui-hood__lock">${raw(icon('lock'))}</span>`}
    </div>
    <div class="ui-hood__body">
      <div class="ui-row" style="align-items:flex-start">
        <h3 class="ui-grow">${spec.name}</h3>
        ${h.unlocked && h.leads > 0 ? html`<span class="ui-chip ui-chip--sun">${raw(icon('door'))}${plural(h.leads, 'lead')}</span>` : ''}
      </div>
      <p class="ui-small ui-muted">${spec.blurb}</p>
      <div class="ui-hood__facts">
        <span data-tip="Lawn sizes">${raw(icon('grass'))}${lawn}</span>
        ${fair ? html`<span data-tip="Typical weekly price">${raw(icon('cash'))}~${money(fair)}</span>` : ''}
        <span data-tip="Travel from where you are">${raw(icon('route'))}${duration(h.travelMinutes || 0)}</span>
        <span>${raw(icon('house'))}${h.clients}/${h.houses} ${spec.bidOnly ? 'sites' : 'homes'}</span>
      </div>
      ${h.unlocked
        ? html`<div class="ui-row" style="margin-top:12px">
            ${spec.bidOnly ? html`<button class="ui-btn ui-btn--sm ui-btn--ghost" data-click="bids">${raw(icon('gavel'))}Bids</button>` : ''}
            <span class="ui-grow"></span>
            <button class="ui-btn ui-btn--go" data-click="open" data-key="${h.key}">${raw(icon(spec.bidOnly ? 'eye' : 'door'))}${spec.bidOnly ? 'Visit' : 'Go knock'}</button>
          </div>`
        : html`<div class="ui-note" style="margin-top:12px">${raw(icon('lock'))}${unlockHint(h)}</div>`}
    </div>
  </article>`;
}

function fallbackHoods(townId: string): HoodView[] {
  const s = store.state;
  return HOODS.map((spec) => {
    const key = `${townId}.${spec.id}`;
    const unlocked = (s.hoods || []).includes(key);
    return {
      key, spec, townId, unlocked, lockReason: unlocked ? '' : 'Grow your reputation to open this area.',
      clients: 0, houses: spec.houses, leads: 0, travelMinutes: 0,
    };
  });
}

function render(): Raw {
  const s = store.state;
  const towns = safe(() => sim.towns(s), TOWNS.map((t) => ({ spec: t, unlocked: (s.towns || ['home']).includes(t.id), canOpen: false, reason: '' })) as TownView[], 'towns');
  if (!towns.find((t) => t.spec.id === ui.mapTown && t.unlocked)) ui.mapTown = towns.find((t) => t.unlocked)?.spec.id || 'home';
  const town = towns.find((t) => t.spec.id === ui.mapTown)!;
  const hoods = safe(() => sim.hoods(s, ui.mapTown), fallbackHoods(ui.mapTown), 'hoods');
  const unlocked = hoods.filter((h) => h.unlocked);
  const locked = hoods.filter((h) => !h.unlocked);
  const lockedTowns = towns.filter((t) => !t.unlocked);
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Map</h1><p>${town?.spec.name || 'Maplewood'}. ${town?.spec.blurb || ''}</p></div>
  </div>
  ${towns.filter((t) => t.unlocked).length > 1 || lockedTowns.length ? html`
  <div class="ui-tabs-bar" role="tablist">
    ${towns.map((t) => t.unlocked
      ? html`<button class="ui-tab ${t.spec.id === ui.mapTown ? 'is-on' : ''}" data-click="town" data-id="${t.spec.id}" role="tab">${raw(icon('pin'))}${t.spec.name}</button>`
      : html`<button class="ui-tab" data-click="branch" data-id="${t.spec.id}" ${t.canOpen ? '' : raw('aria-disabled="true"')} data-tip="${t.canOpen ? `Open a branch for ${money(t.spec.branchCost)}` : t.reason || `Branch costs ${money(t.spec.branchCost)}`}">${raw(icon(t.canOpen ? 'plus' : 'lock'))}${t.spec.name}<span class="ui-count">${money(t.spec.branchCost)}</span></button>`)}
  </div>` : ''}
  <div class="ui-hoods">
    ${unlocked.map(hoodCard)}
    ${locked.map(hoodCard)}
  </div>`;
}

export const mapScreen: Screen = {
  id: 'map',
  render,
  handlers: {
    town: (el) => { ui.mapTown = el.dataset.id || 'home'; rerender(); },
    open: (el) => navigate('hood', el.dataset.key || ''),
    bids: () => { ui.financeTab = 'bids'; navigate('finance'); },
    branch: async (el) => {
      const s = store.state;
      const id = el.dataset.id || '';
      const t = safe(() => sim.towns(s), []).find((x) => x.spec.id === id);
      if (!t) return;
      if (!t.canOpen) { toast(t.reason || 'Not available yet.', 'bad'); return; }
      const ok = await confirmDialog({
        title: `Open a branch in ${t.spec.name}?`,
        body: `Costs ${money(t.spec.branchCost)}. Branches need an Operations Manager, since you cannot commute there every day.`,
        ok: `Open for ${money(t.spec.branchCost)}`,
      });
      if (!ok) return;
      if (act(() => sim.openBranch(s, id), { sound: 'cash' })) { ui.mapTown = id; store.commit(); }
    },
  },
};

// ---------------------------------------------------------------- neighborhood (pitch module, full bleed)
let handle: NeighborhoodHandle | null = null;
let mountedKey = '';

export const hoodScreen: Screen = {
  id: 'hood',
  mount(host, params) {
    const key = params[0] || '';
    const s = store.state;
    if (!key || (s.hoods && s.hoods.length && !s.hoods.includes(key))) {
      toast('That neighborhood is not open yet.', 'bad');
      navigate('map');
      return;
    }
    mountedKey = key;
    try {
      handle = mountNeighborhood(host, key, {
        onStartJob: (clientId: string) => startMow(clientId, routeHash('hood', key)),
        onExit: () => navigate('map'),
      });
    } catch (e) {
      console.error(e);
      host.innerHTML = html`<div class="ui-page"><div class="ui-empty">${raw(icon('map'))}<h3>This neighborhood could not open.</h3><p>Try again from the map.</p><div style="margin-top:14px"><a class="ui-btn ui-btn--go" href="#/map">Back to map</a></div></div></div>`.s;
    }
  },
  unmount() {
    try { handle?.dispose(); } catch (e) { console.error(e); }
    handle = null;
    mountedKey = '';
  },
  refresh() {
    // The pitch module refreshes itself after its own commits; nothing to do here.
    void mountedKey;
  },
};
