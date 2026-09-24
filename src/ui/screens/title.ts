// Title screen: key art, logo, Continue, New Game, Settings.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { loadGame } from '../../core/save';
import { money } from '../../core/format';
import { imageUrl } from '../../data/assets';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import { safe, calSafe } from '../kit';
import { newGameFlow } from '../flows';
import { loadLegacy } from '../prefs';
import { openSettingsModal } from './settings';
import { toast } from '../overlay';

function blades(): Raw {
  // A row of swaying grass blades along the bottom of the CSS scene.
  const out: string[] = [];
  const n = 70;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 100 + ((i * 37) % 7) * 0.2;
    const h = 38 + ((i * 53) % 40);
    const d = ((i * 17) % 20) / 10;
    const shade = i % 3 === 0 ? '#3f8f3f' : i % 3 === 1 ? '#57a84d' : '#6fbf5a';
    out.push(`<i style="left:${x.toFixed(2)}%;height:${h}px;animation-delay:-${d}s;background:${shade}"></i>`);
  }
  return raw(out.join(''));
}

function render(): Raw {
  const save = store.loaded ? store.state : safe(() => loadGame(), null);
  const bank = loadLegacy();
  const legacyPts = Math.max(bank.points, save?.legacy?.points || 0);
  let cont: Raw | '' = '';
  if (save) {
    const cal = calSafe(save.day);
    const clients = (save.clients || []).filter((c) => c.status === 'active').length;
    cont = html`<button class="ui-title__continue" data-click="continue">
      <span class="ui-title__cont-sw" style="background:${save.company?.color || '#2f8f3e'}">${raw(icon('mower'))}</span>
      <span class="ui-grow" style="text-align:left;min-width:0">
        <span class="ui-title__cont-label">Continue</span>
        <span class="ui-title__cont-name">${save.company?.name || 'Your company'}</span>
        <span class="ui-title__cont-meta">${cal.label} · ${money(save.cash)} · ${clients} client${clients === 1 ? '' : 's'}</span>
      </span>
      <span class="ui-title__cont-go">${raw(icon('play'))}</span>
    </button>`;
  }
  return html`
    <div class="ui-title">
      <div class="ui-title__scene" aria-hidden="true">
        <div class="ui-title__sun"></div>
        <div class="ui-title__cloud c1"></div><div class="ui-title__cloud c2"></div><div class="ui-title__cloud c3"></div>
        <div class="ui-title__hill h1"></div><div class="ui-title__hill h2"></div><div class="ui-title__hill h3"></div>
        <div class="ui-title__lawn"></div><div class="ui-title__mower">${raw(icon('mower'))}</div>
        <div class="ui-title__blades">${blades()}</div>
        <img class="ui-title__art" src="${imageUrl('title_bg')}" alt="" data-fallback="hide">
        <div class="ui-title__shade"></div>
      </div>
      <div class="ui-title__panel">
        <div class="ui-title__logo-wrap">
          <img class="ui-title__logo" src="${imageUrl('logo')}" alt="Mow Money" data-fallback="hide">
          <h1 class="ui-wordmark"><span class="w1">Mow</span><span class="w2">Money</span></h1>
        </div>
        <p class="ui-title__tag">Knock on doors. Haggle. Mow. Build a lawn care empire.</p>
        <div class="ui-title__menu">
          ${cont}
          <button class="ui-btn ${save ? '' : 'ui-btn--primary'} ui-btn--lg ui-btn--block" data-click="new">${raw(icon('plus'))}New game</button>
          <button class="ui-btn ui-btn--ghost ui-btn--block ui-title__settings" data-click="settings">${raw(icon('gear'))}Settings</button>
        </div>
        ${legacyPts > 0 ? html`<div class="ui-title__legacy">${raw(icon('crown'))}${legacyPts} legacy point${legacyPts === 1 ? '' : 's'} to spend</div>` : ''}
      </div>
      <div class="ui-title__foot">Progress saves in this browser.</div>
    </div>`;
}

export const titleScreen: Screen = {
  id: 'title',
  bare: true,
  needsGame: false,
  music: 'music_title',
  mount(host) {
    host.innerHTML = render().s;
  },
  handlers: {
    continue: () => {
      if (!store.loaded) {
        const s = safe(() => loadGame(), null);
        if (!s) { toast('No saved company found.', 'bad'); return; }
        store.set(safe(() => sim.migrate(s), s));
      }
      navigate('hub');
    },
    new: () => { void newGameFlow(); },
    settings: () => openSettingsModal(),
  },
  onKey(e) {
    if (e.key === 'Enter') {
      const b = document.querySelector<HTMLElement>('.ui-title__continue') || document.querySelector<HTMLElement>('[data-click="new"]');
      b?.click();
      return true;
    }
    return false;
  },
};

