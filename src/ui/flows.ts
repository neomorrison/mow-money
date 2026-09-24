// Multi-step flows: new game, mow job, autopilot, end of day, winter skip, selling the company.
import * as sim from '../sim';
import { store } from '../core/store';
import { audio } from '../audio';
import { deleteSave, hasSave } from '../core/save';
import { money } from '../core/format';
import { startMowJob, type MowJobHandle } from '../mow';
import type { GameState, JobOutcome, MowJobResult, MowJobSpec } from '../core/types';
import { html, raw } from './html';
import { icon } from './icons';
import { confirmDialog, openModal, toast, closeAllModals, closePopover } from './overlay';
import { navigate, parseHash, routeHash } from './router';
import { safe, calSafe } from './kit';
import { prefs, loadLegacy, saveLegacy, type LegacyBank } from './prefs';
import { ui } from './uistate';
import { suspendScreen } from './app';

export const COMPANY_NAMES = [
  'Cut Above Lawn Co.', 'Lawn and Order', 'Mow Better Lawns', 'The Sod Squad', 'Lawn Rangers', 'Blade Runners Mowing',
  'Grass Roots Lawn Care', 'Fresh Cut Co.', 'Yard Stars', 'Mow Problems', 'Green Acres Mowing', 'Edge of Glory Lawns',
  'Turf Masters', 'Mow Town Lawn Care', 'The Clip Joint', 'Stripe Right Lawns',
];
export const COMPANY_COLORS = ['#2f8f3e', '#d9483b', '#2a7db8', '#e6a100', '#8a63d2', '#ee7a1f', '#15998a', '#d9487f', '#3d4a5c'];

// ---------------------------------------------------------------- new game
export async function newGameFlow(): Promise<void> {
  if (store.loaded || hasSave()) {
    const ok = await confirmDialog({
      title: 'Start a new company?',
      body: 'The current company and its save will be replaced.',
      ok: 'Start over',
      danger: true,
    });
    if (!ok) return;
  }
  openNewGameModal();
}

export function openNewGameModal(): void {
  const bank: LegacyBank = loadLegacy();
  let name = COMPANY_NAMES[0];
  let color = COMPANY_COLORS[0];
  let points = bank.points;
  const owned = new Set(bank.perks);
  const bought = new Set<string>();
  const perks = safe(() => sim.LEGACY_PERKS, []);

  const body = () => html`
    <div class="ui-col" style="gap:18px">
      <div class="ui-field">
        <label for="ui-ng-name">Company name</label>
        <div class="ui-row">
          <input id="ui-ng-name" class="ui-input" maxlength="32" value="${name}" data-input="name" autocomplete="off" spellcheck="false">
          <button class="ui-btn ui-btn--soft ui-btn--icon" data-click="dice" data-tip="Another name" aria-label="Another name">${raw(icon('dice'))}</button>
        </div>
      </div>
      <div class="ui-field">
        <label>Company color</label>
        <div class="ui-row ui-row--wrap" style="gap:6px">
          ${COMPANY_COLORS.map((c) => html`<button class="ui-swatch ${c === color ? 'is-on' : ''}" style="--sw:${c}" data-click="color" data-c="${c}" aria-label="Color ${c}"></button>`)}
        </div>
      </div>
      ${perks.length && (bank.points > 0 || owned.size > 0) ? html`
        <div class="ui-card ui-card--sun ui-card--flat" style="padding:14px">
          <div class="ui-row" style="margin-bottom:10px">
            <span class="ui-card__title" style="font-size:18px">${raw(icon('crown'))}Legacy perks</span>
            <span class="ui-grow"></span>
            <span class="ui-chip ui-chip--dark">${points} point${points === 1 ? '' : 's'}</span>
          </div>
          <div class="ui-col" style="gap:8px">
            ${perks.map((p) => {
              const has = owned.has(p.id) || bought.has(p.id);
              return html`<div class="ui-row" style="gap:10px;background:rgba(255,255,255,.6);border-radius:12px;padding:8px 10px">
                <div class="ui-grow"><div class="ui-strong">${p.name}</div><div class="ui-small ui-muted">${p.blurb}</div></div>
                ${owned.has(p.id)
                  ? html`<span class="ui-chip">${raw(icon('check'))}Owned</span>`
                  : bought.has(p.id)
                    ? html`<button class="ui-btn ui-btn--sm ui-btn--go" data-click="unbuy" data-id="${p.id}">${raw(icon('check'))}Added</button>`
                    : html`<button class="ui-btn ui-btn--sm" data-click="buy" data-id="${p.id}" ${points < p.cost || has ? raw('disabled') : ''}>${p.cost} pt</button>`}
              </div>`;
            })}
          </div>
        </div>` : ''}
    </div>`;

  const m = openModal({
    title: 'New company',
    body: body(),
    actions: html`<button class="ui-btn ui-btn--ghost" data-click="__close">Cancel</button><button class="ui-btn ui-btn--primary ui-btn--lg" data-click="start">${raw(icon('mower'))}Start mowing</button>`,
    handlers: {
      name: (el) => { name = (el as HTMLInputElement).value; },
      dice: () => {
        const others = COMPANY_NAMES.filter((n) => n !== name);
        name = others[Math.floor(Math.random() * others.length)];
        const inp = m.el.querySelector<HTMLInputElement>('#ui-ng-name');
        if (inp) inp.value = name;
      },
      color: (el) => { color = el.dataset.c || color; m.setBody(body()); },
      buy: (el) => {
        const p = perks.find((x) => x.id === el.dataset.id);
        if (!p || points < p.cost) return;
        points -= p.cost; bought.add(p.id); m.setBody(body());
      },
      unbuy: (el) => {
        const p = perks.find((x) => x.id === el.dataset.id);
        if (!p) return;
        points += p.cost; bought.delete(p.id); m.setBody(body());
      },
      start: () => {
        const n = name.trim().slice(0, 32) || COMPANY_NAMES[0];
        const legacyPerks = [...owned, ...bought];
        let state: GameState;
        try {
          state = sim.newGame({ companyName: n, color, legacyPerks, legacyPoints: points, runs: bank.runs });
        } catch (e) {
          console.warn(e);
          toast('The company could not be created. Try again in a moment.', 'bad');
          return;
        }
        saveLegacy({ points, perks: legacyPerks, runs: bank.runs });
        m.close();
        startGame(state);
      },
    },
  });
  setTimeout(() => m.el.querySelector<HTMLInputElement>('#ui-ng-name')?.select(), 60);
}

export function startGame(state: GameState): void {
  store.set(state);
  store.commit({ saveNow: true });
  try { audio.play('deal'); } catch { /* ignore */ }
  navigate('hub');
}

// ---------------------------------------------------------------- mowing (3D job)
let mowHandle: MowJobHandle | null = null;

export function startMow(clientId: string | null, returnTo?: string): void {
  if (!store.loaded) return;
  const s = store.state;
  closePopover();
  let spec: MowJobSpec | { error: string };
  try {
    spec = sim.buildMowJob(s, clientId);
  } catch (e) {
    console.warn(e);
    toast('This job is not ready yet. Try again in a moment.', 'bad');
    return;
  }
  if ('error' in spec) { toast(spec.error, 'bad'); return; }
  const job = spec;
  (job as MowJobSpec & { companyColor?: string }).companyColor = s.company.color;
  const back = returnTo || location.hash || routeHash('hub');
  const host = document.querySelector<HTMLElement>('.ui-fullscreen');
  const appEl = document.querySelector<HTMLElement>('.ui-app');
  if (!host) return;
  closeAllModals();
  suspendScreen();
  const lvlBefore = safe(() => sim.ownerLevel(s).level, s.owner.level);
  host.innerHTML = '';
  host.classList.add('is-on');
  appEl?.classList.add('is-hidden');
  try { audio.music(null); } catch { /* ignore */ }
  let done = false;

  const teardown = () => {
    const h = mowHandle;
    mowHandle = null;
    setTimeout(() => {
      try { h?.dispose(); } catch (e) { console.error(e); }
      host.innerHTML = '';
      host.classList.remove('is-on');
      appEl?.classList.remove('is-hidden');
    }, 0);
  };

  try {
    mowHandle = startMowJob(host, job, {
      onFinish(result: MowJobResult) {
        if (done) return;
        done = true;
        let outcome: JobOutcome | null = null;
        try {
          outcome = sim.completeManualJob(store.state, job, result);
        } catch (e) {
          console.warn(e);
        }
        teardown();
        if (!outcome) {
          toast('The job could not be recorded.', 'bad');
          store.commit({ saveNow: true });
          goHash(back);
          return;
        }
        store.commit({ saveNow: true });
        showResult(outcome, job, 'manual', back, lvlBefore);
      },
      onAbandon(result: MowJobResult) {
        if (done) return;
        done = true;
        let msg = 'Job left unfinished. Nothing was paid.';
        try {
          const r = sim.abandonManualJob(store.state, job, result);
          if (r?.message) msg = r.message;
        } catch (e) { console.warn(e); }
        store.commit({ saveNow: true });
        teardown();
        toast(msg, 'info');
        goHash(back);
      },
    }, prefs.s);
    // Test hook for headless playthroughs (tools/snap.mjs): __mmJob.job.autoMow(), .finishNow().
    (window as unknown as { __mmJob?: unknown }).__mmJob = mowHandle;
  } catch (e) {
    console.error(e);
    teardown();
    toast('The mowing scene could not start.', 'bad');
  }
}

/** Debug and test helper: finish a manual job with synthetic measurements and show the result screen. */
export function debugManualJob(clientId: string | null, coverage = 0.97): string {
  if (!store.loaded) return 'no game';
  const s = store.state;
  const spec = sim.buildMowJob(s, clientId);
  if ('error' in spec) return spec.error;
  const lvlBefore = safe(() => sim.ownerLevel(s).level, s.owner.level);
  const result: MowJobResult = {
    completed: true, coverage, evenness: 0.9, stripe: 0.62, trim: 0.85, cleanup: 0.9, clumps: 0.04,
    removedFraction: 0.32, damages: [], realSeconds: 300, gameMinutes: 60, areaCutM2: spec.lot.w * spec.lot.d * 0.5,
    engineHours: 1, sharpnessLoss: 0.02, cutHeightIn: spec.targetIn,
  };
  const outcome = sim.completeManualJob(s, spec, result);
  store.commit({ saveNow: true });
  showResult(outcome, spec, 'manual', routeHash('hub'), lvlBefore);
  return 'ok';
}

function goHash(h: string): void {
  const r = parseHash(h);
  navigate(r.screen, ...r.params);
}

function showResult(outcome: JobOutcome, spec: MowJobSpec | null, kind: 'manual' | 'autopilot', back: string, lvlBefore: number): void {
  const s = store.state;
  const client = s.clients.find((c) => c.id === outcome.clientId);
  const info = client ? safe(() => sim.houseInfo(s, client.houseId), null) : null;
  const lvlAfter = safe(() => sim.ownerLevel(s).level, s.owner.level);
  ui.result = {
    outcome,
    spec,
    kind,
    address: spec?.address || info?.address || '',
    ownerName: spec?.ownerName || info?.ownerName || 'Client',
    portrait: spec?.portrait || info?.portrait || '',
    returnTo: back,
    levelBefore: lvlBefore,
    levelAfter: lvlAfter,
  };
  navigate('result');
}

export function finishResult(): void {
  const r = ui.result;
  ui.result = null;
  goHash(r?.returnTo || routeHash('hub'));
}

export function runAutopilot(clientId: string): void {
  if (!store.loaded) return;
  const s = store.state;
  const lvlBefore = safe(() => sim.ownerLevel(s).level, s.owner.level);
  let out: JobOutcome | { error: string };
  try {
    out = sim.autopilotJob(s, clientId);
  } catch (e) {
    console.warn(e);
    toast('Autopilot is not available right now.', 'bad');
    return;
  }
  if ('error' in out) { toast(out.error, 'bad'); return; }
  store.commit({ saveNow: true });
  try { audio.play('cash'); } catch { /* ignore */ }
  showResult(out, null, 'autopilot', location.hash || routeHash('hub'), lvlBefore);
}

// ---------------------------------------------------------------- end of day
export async function endDayFlow(): Promise<void> {
  if (!store.loaded) return;
  const s = store.state;
  const tickets = safe(() => sim.jobsToday(s), []);
  const mine = tickets.filter((t) => !t.done && t.assignee === 'owner');
  const cal = calSafe(s.day);
  if (mine.length && cal.isWorkday) {
    const overdue = mine.filter((t) => t.daysOverdue > 0).length;
    const ok = await confirmDialog({
      title: 'End the day?',
      body: html`<p class="ui-modal__body">${mine.length === 1 ? 'One job assigned to you is' : `${mine.length} jobs assigned to you are`} still due${overdue ? html`, <b class="ui-bad">${overdue} overdue</b>` : ''}. Clients lose patience when service is late.</p>`,
      ok: 'End Day',
      cancel: 'Keep working',
    });
    if (!ok) return;
  }
  let report;
  try {
    report = sim.endDay(s);
  } catch (e) {
    console.warn(e);
    toast('The day could not end. Try again in a moment.', 'bad');
    return;
  }
  store.commit({ saveNow: true });
  try { audio.play('day_end'); } catch { /* ignore */ }
  ui.report = report;
  ui.reportShown = false;
  navigate('report');
}

export async function skipWinterFlow(): Promise<void> {
  const ok = await confirmDialog({
    title: 'Skip to spring?',
    body: 'Fixed weekly costs (loans, insurance, staff on payroll) are still paid for every week of winter.',
    ok: 'Skip to spring',
  });
  if (!ok) return;
  let report;
  try {
    report = sim.skipWinter(store.state);
  } catch (e) {
    console.warn(e);
    toast('Winter could not be skipped right now.', 'bad');
    return;
  }
  store.commit({ saveNow: true });
  try { audio.play('day_end'); } catch { /* ignore */ }
  ui.report = report;
  ui.reportShown = false;
  navigate('report');
}

// ---------------------------------------------------------------- selling the company
export async function sellCompanyFlow(): Promise<void> {
  const s = store.state;
  const can = safe(() => sim.canSellCompany(s), { ok: false, message: 'Selling opens after the first year.' });
  if (!can.ok) { toast(can.message || 'Not available yet.', 'bad'); return; }
  const val = safe(() => sim.valuation(s), null);
  const total = val?.total ?? 0;
  const pts = Math.floor(Math.sqrt(Math.max(0, total) / 10000));
  const ok = await confirmDialog({
    title: `Sell ${s.company.name}?`,
    body: html`<div class="ui-col" style="gap:12px">
      <p class="ui-modal__body">A buyer offers <b class="ui-good">${money(total)}</b>. You keep the legacy, not the company.</p>
      <div class="ui-card ui-card--sun ui-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
        <span style="width:40px;height:40px;color:var(--ui-sun-700)">${raw(icon('crown', 'ui-big'))}</span>
        <div><div class="ui-strong" style="font-size:20px">+${pts} legacy point${pts === 1 ? '' : 's'}</div><div class="ui-small ui-muted">Spend them on perks for your next company.</div></div>
      </div>
      <p class="ui-small ui-bad ui-strong">Clients, staff, equipment and cash go with the sale. This cannot be undone.</p>
    </div>`,
    ok: 'Sell the company',
    danger: true,
  });
  if (!ok) return;
  const before = s.legacy?.points || 0;
  let res: { points: number; valuation: number };
  try {
    res = sim.sellCompany(s);
  } catch (e) {
    console.warn(e);
    toast('The sale did not go through. Try again in a moment.', 'bad');
    return;
  }
  const bank: LegacyBank = {
    points: before + (res.points || 0),
    perks: [...(s.legacy?.perks || [])],
    runs: (s.legacy?.runs || 0) + 1,
  };
  saveLegacy(bank);
  deleteSave();
  store.set(null);
  try { audio.play('achievement'); } catch { /* ignore */ }
  navigate('title');
  setTimeout(() => {
    toast(`Sold for ${money(res.valuation || total)}. ${res.points} legacy point${res.points === 1 ? '' : 's'} earned.`, 'good');
    openNewGameModal();
  }, 350);
}

export async function deleteSaveFlow(): Promise<void> {
  const ok = await confirmDialog({
    title: 'Delete the save?',
    body: 'Your company and all progress in this browser will be erased. Export a save code first if you want a backup.',
    ok: 'Delete save',
    danger: true,
  });
  if (!ok) return;
  deleteSave();
  store.set(null);
  closeAllModals();
  navigate('title');
  toast('Save deleted.', 'info');
}
