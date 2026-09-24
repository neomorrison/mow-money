// Skills: three owner perk trees with requirements and skill points.
import * as sim from '../../sim';
import { store } from '../../core/store';
import type { PerkSpec } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { safe, act, ring } from '../kit';

const TREES: { id: PerkSpec['tree']; name: string; icon: string; blurb: string; color: string }[] = [
  { id: 'sales', name: 'Sales', icon: 'handshake', blurb: 'Win more doors at better prices.', color: '#2a7db8' },
  { id: 'craft', name: 'Craft', icon: 'mower', blurb: 'Cleaner lines, faster jobs.', color: '#3a8744' },
  { id: 'management', name: 'Management', icon: 'crew', blurb: 'Crews, dispatch and money.', color: '#8a63d2' },
];

function ordered(perks: PerkSpec[]): PerkSpec[] {
  // Parents before children, keeping catalog order otherwise
  const out: PerkSpec[] = [];
  const seen = new Set<string>();
  const add = (p: PerkSpec) => {
    if (seen.has(p.id)) return;
    const parent = p.requires ? perks.find((x) => x.id === p.requires) : undefined;
    if (parent) add(parent);
    seen.add(p.id);
    out.push(p);
  };
  perks.forEach(add);
  return out;
}

function render(): Raw {
  const s = store.state;
  const lvl = safe(() => sim.ownerLevel(s), { level: s.owner.level || 1, xp: s.owner.xp, xpForNext: 100, xpIntoLevel: 0, progress: 0, skillPoints: s.owner.skillPoints });
  const perks = safe(() => sim.PERKS, []);
  const have = new Set(s.owner.perks || []);
  const all = [...perks];
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Skills</h1><p>One skill point per level. XP comes from mowing, deals and bids.</p></div>
  </div>
  <div class="ui-card ui-card--sun ui-levelcard">
    ${ring(lvl.progress, lvl.level, 'var(--ui-sun-600)')}
    <div class="ui-grow">
      <div class="ui-strong" style="font-size:20px;font-family:var(--ui-font-display)">Level ${lvl.level}</div>
      <div class="ui-small ui-muted ui-strong">${Math.round(lvl.xpIntoLevel)} of ${Math.round(lvl.xpForNext)} XP to level ${lvl.level + 1}</div>
    </div>
    <div class="ui-levelcard__pts ${lvl.skillPoints ? 'has' : ''}"><b>${lvl.skillPoints}</b><span>skill point${lvl.skillPoints === 1 ? '' : 's'}</span></div>
  </div>
  ${all.length ? html`
  <div class="ui-trees">
    ${TREES.map((t) => {
      const list = ordered(all.filter((p) => p.tree === t.id));
      return html`<section class="ui-tree" style="--tree:${t.color}">
        <div class="ui-tree__head"><span class="ui-tree__ic">${raw(icon(t.icon))}</span><div><h2>${t.name}</h2><p class="ui-small ui-muted">${t.blurb}</p></div></div>
        <div class="ui-tree__nodes">
          ${list.map((p) => {
            const owned = have.has(p.id);
            const reqOk = !p.requires || have.has(p.requires);
            const req = p.requires ? all.find((x) => x.id === p.requires) : undefined;
            const can = !owned && reqOk && lvl.skillPoints > 0;
            return html`<div class="ui-perk ${owned ? 'is-owned' : can ? 'is-ready' : ''} ${p.requires ? 'is-child' : ''}">
              <span class="ui-perk__dot">${raw(icon(owned ? 'check' : reqOk ? 'star' : 'lock'))}</span>
              <div class="ui-grow">
                <b>${p.name}</b>
                <div class="ui-small ui-muted">${p.blurb}</div>
                ${!reqOk && req ? html`<div class="ui-tiny ui-strong" style="color:var(--tree);margin-top:2px">Needs ${req.name}</div>` : ''}
              </div>
              ${owned ? html`<span class="ui-chip">Learned</span>` : html`<button class="ui-btn ui-btn--sm ${can ? 'ui-btn--primary' : ''}" data-click="unlock" data-id="${p.id}" ${can ? '' : raw('disabled')}>Learn</button>`}
            </div>`;
          })}
        </div>
      </section>`;
    })}
  </div>` : html`<div class="ui-empty">${raw(icon('skills'))}<h3>Perks load with your company.</h3></div>`}
  `;
}

export const skillsScreen: Screen = {
  id: 'skills',
  render,
  handlers: {
    unlock: (el) => act(() => sim.unlockPerk(store.state, el.dataset.id || ''), { sound: 'level_up' }),
  },
};
