// Crew: staff roster, hiring board, crews builder, sales rep assignment, winter layoffs.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, duration } from '../../core/format';
import { EQUIPMENT_BY_ID } from '../../data/equipment';
import type { Candidate, Crew, CrewPlan, Employee, EquipmentCategory, GameState, StaffRole } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import { safe, act, calSafe, avatar, bar, emptyState, plural, clamp } from '../kit';
import { confirmDialog } from '../overlay';
import { ui } from '../uistate';
import { rerender } from '../app';

export const ROLE_LABEL: Record<StaffRole, string> = {
  operator: 'Operator', lead: 'Crew Lead', sales: 'Sales Rep', mechanic: 'Mechanic', office: 'Office Manager', manager: 'Operations Manager',
};
const ROLE_ICON: Record<StaffRole, string> = { operator: 'mower', lead: 'crown', sales: 'handshake', mechanic: 'wrench', office: 'calendar', manager: 'briefcase' };
const ROLE_BLURB: Record<StaffRole, string> = {
  operator: 'Mows on a crew.',
  lead: 'Runs a crew and drives the truck. +4 quality.',
  sales: 'Knocks doors in an assigned neighborhood.',
  mechanic: 'Sharpens and repairs overnight. Fewer breakdowns.',
  office: 'Dispatches due jobs to crews every morning.',
  manager: 'Hires replacements, buys fuel, runs branches.',
};
const TRAIT_TIP: Record<string, string> = {
  Perfectionist: 'Higher quality, a bit slower.',
  Speedy: 'Works faster.',
  Chatty: 'Clients like them. Sales reps close more.',
  Unreliable: 'Sometimes does not show up.',
  Veteran: 'Years of experience.',
};
const draftWage: Record<string, string> = {};

function moraleColor(m: number): string {
  return m >= 65 ? 'var(--ui-g-500)' : m >= 45 ? 'var(--ui-sun-500)' : m >= 30 ? 'var(--ui-orange)' : 'var(--ui-red)';
}

function traits(list: string[]): Raw {
  return html`${list.map((t) => html`<span class="ui-chip ${t === 'Unreliable' ? 'ui-chip--red' : t === 'Veteran' || t === 'Perfectionist' ? 'ui-chip--sun' : 'ui-chip--sky'}" data-tip="${TRAIT_TIP[t] || t}">${t}</span>`)}`;
}

function staffCard(e: Employee, s: GameState): Raw {
  const market = safe(() => sim.marketWage(e.role, e.skill), e.wage);
  const crew = e.crewId ? s.crews.find((c) => c.id === e.crewId) : null;
  const diff = e.wage - market;
  const unlocked = safe(() => sim.hoods(s).filter((h) => h.unlocked && !h.spec.bidOnly), []);
  return html`
  <article class="ui-person ${e.laidOff ? 'is-off' : ''}">
    <div class="ui-person__head">
      ${avatar(e.portrait, e.name, 56)}
      <div class="ui-grow" style="min-width:0">
        <b class="ui-person__name">${e.name}</b>
        <div class="ui-row ui-row--wrap" style="gap:5px;margin-top:3px">
          <span class="ui-chip">${raw(icon(ROLE_ICON[e.role]))}${ROLE_LABEL[e.role]}</span>
          ${crew ? html`<span class="ui-chip ui-chip--grey"><span class="ui-sw-dot" style="background:${crew.color}"></span>${crew.name}</span>` : ''}
          ${e.laidOff ? html`<span class="ui-chip ui-chip--grey">${raw(icon('snow'))}Laid off</span>` : ''}
        </div>
      </div>
    </div>
    <div class="ui-row ui-row--wrap" style="gap:5px">${traits(e.traits || [])}</div>
    <div class="ui-person__meters">
      <div class="ui-meter"><span class="ui-meter__label">Skill</span><span class="ui-meter__val">${Math.round(e.skill)}</span>${bar(e.skill / 100, { color: 'var(--ui-sky-500)', cls: 'ui-bar--thin' })}</div>
      <div class="ui-meter"><span class="ui-meter__label">Morale</span><span class="ui-meter__val">${Math.round(e.morale)}</span>${bar(e.morale / 100, { color: moraleColor(e.morale), cls: 'ui-bar--thin' })}</div>
    </div>
    <div class="ui-tiny ui-muted">${plural(e.jobs || 0, 'job')} · hired ${calSafe(e.hiredDay).label}</div>
    ${e.role === 'sales' ? html`
      <label class="ui-field"><span class="ui-label">Knocks in</span>
        <select class="ui-select ui-select--sm" data-change="salesHood" data-id="${e.id}">
          <option value="" ${!e.assignedHood ? raw('selected') : ''} disabled>Pick a neighborhood</option>
          ${unlocked.map((h) => html`<option value="${h.key}" ${e.assignedHood === h.key ? raw('selected') : ''}>${h.spec.name}</option>`)}
        </select>
      </label>` : ''}
    <div class="ui-person__wage">
      <div class="ui-grow">
        <div class="ui-label">Wage per hour</div>
        <div class="ui-tiny ${diff < -0.5 ? 'ui-bad' : diff > 0.5 ? 'ui-good' : 'ui-muted'} ui-strong">Market ${money(market, true)}${diff < -0.5 ? '. Underpaid: morale drops.' : diff > 0.5 ? '. Paid above market.' : ''}</div>
      </div>
      <div class="ui-money-input" style="width:96px"><input class="ui-input ui-input--sm" type="number" step="0.5" min="1" inputmode="decimal" value="${draftWage[e.id] ?? e.wage.toFixed(2)}" data-input="wage" data-id="${e.id}" aria-label="Wage"></div>
      <button class="ui-btn ui-btn--sm" data-click="setWage" data-id="${e.id}">Set</button>
    </div>
    <div class="ui-row" style="justify-content:flex-end">
      <button class="ui-btn ui-btn--sm ui-btn--ghost ui-bad" data-click="fire" data-id="${e.id}">Fire</button>
    </div>
  </article>`;
}

function candidateCard(c: Candidate): Raw {
  const market = safe(() => sim.marketWage(c.role, c.skill), c.askWage);
  return html`
  <article class="ui-person ui-person--cand">
    <div class="ui-person__head">
      ${avatar(c.portrait, c.name, 56)}
      <div class="ui-grow" style="min-width:0">
        <b class="ui-person__name">${c.name}</b>
        <div class="ui-row ui-row--wrap" style="gap:5px;margin-top:3px"><span class="ui-chip">${raw(icon(ROLE_ICON[c.role]))}${ROLE_LABEL[c.role]}</span></div>
      </div>
      <div class="ui-person__ask"><b>${money(c.askWage, true)}</b><small>per hour</small></div>
    </div>
    <p class="ui-tiny ui-muted">${ROLE_BLURB[c.role]}</p>
    <div class="ui-row ui-row--wrap" style="gap:5px">${traits(c.traits || [])}</div>
    <div class="ui-person__meters">
      <div class="ui-meter"><span class="ui-meter__label">Skill</span><span class="ui-meter__val">${Math.round(c.skill)}</span>${bar(c.skill / 100, { color: 'var(--ui-sky-500)', cls: 'ui-bar--thin' })}</div>
      <div class="ui-meter"><span class="ui-meter__label">Speed</span><span class="ui-meter__val">${Math.round(c.speed * 100)}%</span>${bar(clamp((c.speed - 0.7) / 0.6, 0, 1), { color: 'var(--ui-purple)', cls: 'ui-bar--thin' })}</div>
      <div class="ui-meter"><span class="ui-meter__label">Reliability</span><span class="ui-meter__val">${Math.round(c.reliability * 100)}%</span>${bar(c.reliability, { color: 'var(--ui-g-500)', cls: 'ui-bar--thin' })}</div>
    </div>
    <div class="ui-row">
      <span class="ui-tiny ui-muted ui-grow">Market ${money(market, true)}. Paid 10 h per workday: ${money(c.askWage * 10)} a day.</span>
      <button class="ui-btn ui-btn--go ui-btn--sm" data-click="hire" data-id="${c.id}">${raw(icon('handshake'))}Hire</button>
    </div>
  </article>`;
}

function itemLabel(uid: string, s: GameState, crewId: string): string {
  const it = s.items.find((i) => i.uid === uid);
  if (!it) return 'Unknown';
  const spec = EQUIPMENT_BY_ID[it.specId];
  let where = '';
  const ownerHas = [s.owner.mowerUid, s.owner.trimmerUid, s.owner.blowerUid, s.owner.vehicleUid].includes(uid);
  if (it.crewId && it.crewId !== crewId) where = ` (${s.crews.find((c) => c.id === it.crewId)?.name || 'another crew'})`;
  else if (!it.crewId && ownerHas) where = ' (yours)';
  return `${spec?.name || it.specId}${it.broken ? ' (broken)' : ''}${where}`;
}

function gearSelect(crew: Crew, s: GameState, cat: EquipmentCategory, field: 'vehicleUid' | 'mowerUid' | 'trimmerUid' | 'blowerUid', label: string, ic: string): Raw {
  const items = s.items.filter((i) => EQUIPMENT_BY_ID[i.specId]?.category === cat);
  const cur = crew[field];
  return html`<label class="ui-field"><span class="ui-label">${raw(icon(ic))} ${label}</span>
    <select class="ui-select ui-select--sm" data-change="gear" data-crew="${crew.id}" data-field="${field}">
      <option value="">None</option>
      ${items.map((i) => html`<option value="${i.uid}" ${cur === i.uid ? raw('selected') : ''}>${itemLabel(i.uid, s, crew.id)}</option>`)}
    </select></label>`;
}

function crewCard(crew: Crew, s: GameState, plan: CrewPlan | undefined): Raw {
  const members = crew.memberIds.map((id) => s.staff.find((e) => e.id === id)).filter(Boolean) as Employee[];
  const free = s.staff.filter((e) => !e.crewId && (e.role === 'operator' || e.role === 'lead') && !e.laidOff);
  const hoods = safe(() => sim.hoods(s).filter((h) => h.unlocked), []);
  const load = plan && plan.capacity > 0 ? plan.minutes / plan.capacity : 0;
  return html`
  <article class="ui-card ui-crew-card" style="--crew:${crew.color}">
    <div class="ui-card__head">
      <span class="ui-crew-sw"></span>
      <h3 style="font-size:22px">${crew.name}</h3>
      <button class="ui-btn ui-btn--sm ui-btn--ghost" data-click="disband" data-id="${crew.id}">Disband</button>
    </div>
    ${plan ? html`<div style="margin-bottom:14px">
      <div class="ui-row" style="justify-content:space-between"><span class="ui-small ui-strong">Today: ${plural(plan.jobs.length, 'job')}</span><span class="ui-small ui-muted">${duration(plan.minutes)} of ${duration(plan.capacity)}</span></div>
      ${bar(load, { color: load > 1 ? 'var(--ui-red)' : 'var(--ui-g-500)' })}
      ${plan.problem ? html`<div class="ui-note ui-note--warn" style="margin-top:8px">${raw(icon('alert'))}${plan.problem}</div>` : ''}
    </div>` : ''}
    <div class="ui-label">Members</div>
    <div class="ui-col" style="gap:6px;margin:6px 0 10px">
      ${members.length ? members.map((m) => html`<div class="ui-row ui-member">${avatar(m.portrait, m.name, 34)}<div class="ui-grow"><b>${m.name}</b><div class="ui-tiny ui-muted">${ROLE_LABEL[m.role]} · skill ${Math.round(m.skill)}</div></div><button class="ui-btn ui-btn--sm ui-btn--ghost ui-btn--icon" data-click="unassign" data-id="${m.id}" aria-label="Remove ${m.name}" data-tip="Remove from crew">${raw(icon('x'))}</button></div>`) : html`<p class="ui-small ui-muted">No members. A crew needs a lead or operator.</p>`}
    </div>
    ${free.length ? html`<select class="ui-select ui-select--sm" data-change="addMember" data-crew="${crew.id}"><option value="">Add a member</option>${free.map((e) => html`<option value="${e.id}">${e.name} (${ROLE_LABEL[e.role]})</option>`)}</select>` : ''}
    <div class="ui-grid ui-grid--2" style="gap:10px;margin-top:14px">
      ${gearSelect(crew, s, 'vehicle', 'vehicleUid', 'Vehicle', 'truck')}
      ${gearSelect(crew, s, 'mower', 'mowerUid', 'Mower', 'mower')}
      ${gearSelect(crew, s, 'trimmer', 'trimmerUid', 'Trimmer', 'trimmer')}
      ${gearSelect(crew, s, 'blower', 'blowerUid', 'Blower', 'blower')}
    </div>
    <label class="ui-field" style="margin-top:10px"><span class="ui-label">${raw(icon('pin'))} Home neighborhood</span>
      <select class="ui-select ui-select--sm" data-change="home" data-crew="${crew.id}">
        <option value="">Anywhere</option>
        ${hoods.map((h) => html`<option value="${h.key}" ${crew.homeHood === h.key ? raw('selected') : ''}>${h.spec.name}</option>`)}
      </select></label>
  </article>`;
}

function render(): Raw {
  const s = store.state;
  const cal = calSafe(s.day);
  const staff = s.staff || [];
  const cands = s.candidates || [];
  const plans = safe(() => sim.crewPlans(s), [] as CrewPlan[]);
  const wagesDay = staff.filter((e) => !e.laidOff).reduce((a, e) => a + e.wage * 10, 0);
  const laidOff = staff.some((e) => e.laidOff);
  const tab = ui.crewTab;
  const salesReps = staff.filter((e) => e.role === 'sales');
  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text"><h1>Crew</h1><p>${plural(staff.length, 'employee')} · ${plural(s.crews.length, 'crew')} · payroll ${money(wagesDay)} per workday</p></div>
    ${cal.season === 'winter' && staff.length ? html`<button class="ui-btn ui-btn--sky" data-click="layoff" data-on="${laidOff ? '0' : '1'}">${raw(icon('snow'))}${laidOff ? 'Bring staff back' : 'Winter layoffs'}</button>` : ''}
  </div>
  ${!s.insured ? html`<div class="ui-note ui-note--warn" style="margin-bottom:16px">${raw(icon('shield'))}<span class="ui-grow">Insurance is required before your first hire.</span><button class="ui-btn ui-btn--sm" data-click="finance">Get insured</button></div>` : ''}
  <div class="ui-tabs-bar" role="tablist">
    <button class="ui-tab ${tab === 'staff' ? 'is-on' : ''}" data-click="tab" data-id="staff">${raw(icon('user'))}Staff<span class="ui-count">${staff.length}</span></button>
    <button class="ui-tab ${tab === 'hiring' ? 'is-on' : ''}" data-click="tab" data-id="hiring">${raw(icon('handshake'))}Hiring board<span class="ui-count">${cands.length}</span></button>
    <button class="ui-tab ${tab === 'crews' ? 'is-on' : ''}" data-click="tab" data-id="crews">${raw(icon('truck'))}Crews<span class="ui-count">${s.crews.length}</span></button>
  </div>
  ${tab === 'staff' ? html`
    ${staff.length ? html`<div class="ui-grid ui-grid--auto">${staff.map((e) => staffCard(e, s))}</div>`
      : emptyState('crew', 'No staff yet', 'Hire operators and a crew lead, then put them on a crew with gear.', html`<button class="ui-btn ui-btn--go" data-click="tab" data-id="hiring">${raw(icon('handshake'))}Hiring board</button>`)}
    ${salesReps.length ? html`<p class="ui-small ui-muted" style="margin-top:14px">${raw(icon('info'))} Sales reps make 30 knocks a day in their neighborhood and earn 8 percent of each new client's first month.</p>` : ''}
  ` : ''}
  ${tab === 'hiring' ? html`
    <div class="ui-row ui-row--wrap" style="margin-bottom:16px;gap:12px">
      <p class="ui-muted ui-strong ui-grow">New candidates every Monday.</p>
      <button class="ui-btn ui-btn--primary" data-click="ad">${raw(icon('megaphone'))}Post a job ad · $40</button>
    </div>
    ${cands.length ? html`<div class="ui-grid ui-grid--auto">${cands.map(candidateCard)}</div>` : emptyState('handshake', 'No candidates this week', 'Post a job ad or check back Monday.')}
  ` : ''}
  ${tab === 'crews' ? html`
    <div class="ui-row ui-row--wrap" style="margin-bottom:16px;gap:12px">
      <p class="ui-muted ui-strong ui-grow">A crew needs a vehicle, a mower and a lead or operator. Crews work 600 minutes a day.</p>
      <button class="ui-btn ui-btn--primary" data-click="newCrew">${raw(icon('plus'))}New crew</button>
    </div>
    ${s.crews.length ? html`<div class="ui-grid ui-grid--auto" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${s.crews.map((c) => crewCard(c, s, plans.find((p) => p.crewId === c.id)))}</div>`
      : emptyState('truck', 'No crews yet', 'Crews mow client lawns while you knock doors or mow elsewhere.')}
  ` : ''}
  `;
}

export const crewScreen: Screen = {
  id: 'crew',
  render,
  handlers: {
    tab: (el) => { ui.crewTab = (el.dataset.id as typeof ui.crewTab) || 'staff'; rerender(); },
    finance: () => { ui.financeTab = 'overview'; navigate('finance'); },
    layoff: (el) => act(() => sim.winterLayoff(store.state, el.dataset.on === '1')),
    wage: (el) => { draftWage[el.dataset.id || ''] = (el as HTMLInputElement).value; },
    setWage: (el) => {
      const id = el.dataset.id || '';
      const v = Number(draftWage[id]);
      if (!Number.isFinite(v) || v <= 0) return;
      act(() => sim.setWage(store.state, id, Math.round(v * 100) / 100));
      delete draftWage[id];
    },
    fire: async (el) => {
      const e = store.state.staff.find((x) => x.id === el.dataset.id);
      if (!e) return;
      const ok = await confirmDialog({ title: `Fire ${e.name}?`, body: 'They leave today. Morale on the team takes a small hit.', ok: 'Fire', danger: true });
      if (ok) act(() => sim.fire(store.state, e.id));
    },
    hire: (el) => act(() => sim.hire(store.state, el.dataset.id || ''), { sound: 'deal' }),
    ad: () => act(() => sim.postJobAd(store.state), { sound: 'cash' }),
    salesHood: (el) => act(() => sim.assignSalesHood(store.state, el.dataset.id || '', (el as HTMLSelectElement).value)),
    newCrew: () => act(() => sim.createCrew(store.state)),
    disband: async (el) => {
      const c = store.state.crews.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const ok = await confirmDialog({ title: `Disband ${c.name}?`, body: 'Members and gear go back to the pool. Their jobs return to you.', ok: 'Disband', danger: true });
      if (ok) act(() => sim.disbandCrew(store.state, c.id));
    },
    unassign: (el) => act(() => sim.assignToCrew(store.state, el.dataset.id || '', null), { quietOk: true }),
    addMember: (el) => {
      const v = (el as HTMLSelectElement).value;
      if (v) act(() => sim.assignToCrew(store.state, v, el.dataset.crew || ''), { quietOk: true });
    },
    gear: (el) => {
      const field = el.dataset.field as 'vehicleUid' | 'mowerUid' | 'trimmerUid' | 'blowerUid';
      const v = (el as HTMLSelectElement).value || null;
      act(() => sim.setCrewGear(store.state, el.dataset.crew || '', { [field]: v }), { quietOk: true });
    },
    home: (el) => act(() => sim.setCrewHome(store.state, el.dataset.crew || '', (el as HTMLSelectElement).value || null), { quietOk: true }),
  },
};

