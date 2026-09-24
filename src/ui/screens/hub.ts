// Hub (Today): jobs due, forecast, crew plans, leads, tutorial hints and End Day.
import * as sim from '../../sim';
import { store } from '../../core/store';
import { money, sqft, inches, duration, clock } from '../../core/format';
import { EQUIPMENT_BY_ID } from '../../data/equipment';
import type { CrewPlan, GameState, JobTicket } from '../../core/types';
import { html, raw, type Raw } from '../html';
import { icon, weatherIcon } from '../icons';
import type { Screen } from '../screen';
import { navigate } from '../router';
import {
  safe, act, calSafe, avatar, bar, satColor, satLabel, WEATHER_LABEL, WEATHER_NOTE, WEEKDAYS_LONG, emptyState, plural, clamp,
} from '../kit';
import { autopilotAllFlow, endDayFlow, runAutopilot, skipWinterFlow, startMow } from '../flows';
import { prefs } from '../prefs';
import { ui } from '../uistate';
import { toast } from '../overlay';

const TUTORIAL: Record<number, { text: string; action?: { label: string; click: string; icon: string } }> = {
  1: { text: 'Rose next door wants her lawn mowed. Open the map and knock on her door.', action: { label: 'Open the map', click: 'map', icon: 'map' } },
  2: { text: "Mow Rose's lawn.", action: { label: 'Go to jobs', click: 'scrollJobs', icon: 'mower' } },
  3: { text: 'Knock on three more doors in Maple Grove.', action: { label: 'Maple Grove', click: 'maple', icon: 'door' } },
  4: { text: 'End the day to get paid and see how clients feel.', action: { label: 'End Day', click: 'endDay', icon: 'moon' } },
};

function greeting(minute: number): string {
  if (minute < 12 * 60) return 'Good morning';
  if (minute < 17 * 60) return 'Good afternoon';
  return 'Good evening';
}

/** Money earned today: gear bought or sold and loans are investments, not a bad day. */
function todayNet(s: GameState): number {
  const capital = ['equipment', 'sale', 'loan', 'branch'];
  return (s.ledger || []).filter((e) => e.day === s.day && !capital.includes(e.cat)).reduce((a, e) => a + e.amount, 0);
}

function ticketCard(t: JobTicket, s: GameState, issues: Map<string, string>): Raw {
  const crewIssue = (_: GameState, id: string) => issues.get(id) ?? '';
  const crews = s.crews || [];
  const grassHot = t.grassIn >= 5.5;
  const due = t.done
    ? html`<span class="ui-chip">${raw(icon('check'))}Done today</span>`
    : t.daysOverdue > 0
      ? html`<span class="ui-chip ui-chip--red">${raw(icon('alert'))}${t.daysOverdue === 1 ? '1 day late' : `${t.daysOverdue} days late`}</span>`
      : t.dueDay < s.day
        ? html`<span class="ui-chip ui-chip--orange">${raw(icon('clock'))}Grace day</span>`
        : t.dueDay > s.day
          ? html`<span class="ui-chip ui-chip--grey">${raw(icon('calendar'))}Due ${WEEKDAYS_LONG[calSafe(t.dueDay).weekday]}</span>`
          : html`<span class="ui-chip ui-chip--sky">${raw(icon('calendar'))}Due today</span>`;
  const mine = t.assignee === 'owner';
  return html`
  <article class="ui-ticket ${t.done ? 'is-done' : ''} ${t.daysOverdue > 0 && !t.done ? 'is-late' : ''}">
    <div class="ui-ticket__head">
      ${avatar(t.portrait, t.ownerName, 54)}
      <div class="ui-grow">
        <div class="ui-ticket__name">${t.ownerName}${t.trial ? html` <span class="ui-chip ui-chip--sun" data-tip="First mow is free. Beat their expectation and they sign.">Trial</span>` : ''}</div>
        <div class="ui-ticket__addr">${raw(icon('pin'))}${t.address} · ${t.hoodName}</div>
      </div>
      <div class="ui-ticket__price">
        <b>${t.trial ? 'Free' : money(t.price)}</b>
        <small>${t.trial ? 'trial mow' : 'per mow'}</small>
      </div>
    </div>
    <div class="ui-ticket__chips">
      ${due}
      <span class="ui-chip ui-chip--grey">${raw(icon('grass'))}${sqft(t.lawnM2)}</span>
      <span class="ui-chip ${grassHot ? 'ui-chip--orange' : 'ui-chip--grey'}" data-tip="${grassHot ? 'Tall grass. Raise the deck to avoid scalping.' : 'Grass height'}">${raw(icon('leaf'))}${inches(t.grassIn)}</span>
      ${mine && !t.done ? html`<span class="ui-chip ui-chip--grey" data-tip="Travel, setup and mowing with your current kit">${raw(icon('clock'))}~${duration(t.estMinutes)}</span>` : ''}
    </div>
    <div class="ui-ticket__sat">
      <span class="ui-small ui-strong" style="color:${satColor(t.satisfaction)}">${satLabel(t.satisfaction)}</span>
      ${bar(t.satisfaction / 100, { color: satColor(t.satisfaction), cls: 'ui-bar--thin' })}
      <span class="ui-small ui-muted ui-num">${Math.round(t.satisfaction)}</span>
    </div>
    ${t.done ? '' : html`
    <div class="ui-ticket__actions">
      <label class="ui-ticket__assign">
        <span class="ui-sr">Assign to</span>
        <select class="ui-select ui-select--sm" data-change="assign" data-id="${t.clientId}">
          <option value="owner" ${mine ? raw('selected') : ''}>You</option>
          ${crews.map((c) => html`<option value="${c.id}" ${t.assignee === c.id ? raw('selected') : ''}>${c.name}</option>`)}
        </select>
      </label>
      <span class="ui-grow"></span>
      <button class="ui-btn ui-btn--sm ui-btn--ghost" data-click="goHood" data-key="${t.hoodKey}" data-tip="Open ${t.hoodName}">${raw(icon('map'))}<span class="ui-hide-xs">Map</span></button>
      ${mine && t.canAutopilot ? html`<button class="ui-btn ui-btn--sm ui-btn--sky" data-click="auto" data-id="${t.clientId}" data-tip="Mow on autopilot, about ${duration(t.estMinutes)}. Quality near your best here.">${raw(icon('robot'))}Auto</button>` : ''}
      ${mine ? html`<button class="ui-btn ui-btn--sm ui-btn--go" data-click="mow" data-id="${t.clientId}">${raw(icon('mower'))}Mow</button>` : crewIssue(s, t.assignee) ? html`<span class="ui-chip ui-chip--red" data-tip="${crewIssue(s, t.assignee)}">${raw(icon('alert'))}Crew not ready</span>` : html`<span class="ui-chip ui-chip--sky">${raw(icon('truck'))}Crew</span>`}
    </div>`}
  </article>`;
}

function crewPlanCard(p: CrewPlan, s: GameState): Raw {
  const crew = s.crews.find((c) => c.id === p.crewId);
  const name = crew?.name || 'Crew';
  const load = p.capacity > 0 ? p.minutes / p.capacity : 0;
  return html`<div class="ui-plan">
    <span class="ui-plan__sw" style="background:${crew?.color || 'var(--ui-g-500)'}"></span>
    <div class="ui-grow">
      <div class="ui-row" style="justify-content:space-between"><b>${name}</b><span class="ui-small ui-muted">${plural(p.jobs.length, 'job')} · ${duration(p.minutes)} of ${duration(p.capacity)}</span></div>
      ${bar(load, { cls: 'ui-bar--thin', color: load > 1 ? 'var(--ui-red)' : load > 0.85 ? 'var(--ui-orange)' : 'var(--ui-g-500)' })}
      ${!p.ready || p.problem ? html`<div class="ui-small ui-bad ui-strong" style="margin-top:4px">${raw(icon('alert'))} ${p.problem || 'Not ready'}</div>` : ''}
      ${p.note ? html`<div class="ui-tiny ui-muted ui-strong" style="margin-top:4px">${raw(icon(/^Storm|^Sunday/.test(p.note) ? 'storm' : 'moon'))} ${p.note}</div>` : ''}
    </div>
  </div>`;
}

function kitCard(s: GameState): Raw {
  const item = (uid: string | null) => (uid ? s.items.find((i) => i.uid === uid) : undefined);
  const mower = item(s.owner.mowerUid);
  const veh = item(s.owner.vehicleUid);
  const ms = mower ? EQUIPMENT_BY_ID[mower.specId] : undefined;
  const vs = veh ? EQUIPMENT_BY_ID[veh.specId] : undefined;
  const sharp = mower?.sharpness ?? 1;
  return html`<div class="ui-card ui-card--flat">
    <div class="ui-card__head"><span class="ui-card__title">${raw(icon('mower'))}Your kit</span><button class="ui-link" data-click="nav" data-id="garage">Garage</button></div>
    <div class="ui-col" style="gap:10px">
      <div class="ui-row"><span class="ui-kit-ic">${raw(icon('mower'))}</span><div class="ui-grow"><div class="ui-strong">${ms?.name || 'No mower'}</div>
        ${mower ? html`<div class="ui-row" style="gap:8px"><span class="ui-tiny ui-muted" style="width:40px">Blade</span><div class="ui-grow">${bar(sharp, { cls: 'ui-bar--thin', color: sharp < 0.5 ? 'var(--ui-orange)' : 'var(--ui-g-500)' })}</div><span class="ui-tiny ui-strong ui-num">${Math.round(sharp * 100)}%</span></div>` : ''}
      </div></div>
      <div class="ui-row"><span class="ui-kit-ic">${raw(icon(vs?.id === 'bike' ? 'bike' : 'truck'))}</span><div class="ui-grow"><div class="ui-strong">${vs?.name || 'On foot'}</div>${vs?.travelSpeedKmh ? html`<div class="ui-tiny ui-muted">${vs.travelSpeedKmh} km/h</div>` : ''}</div></div>
      ${mower && sharp < 0.55 ? html`<div class="ui-note ui-note--warn">${raw(icon('sharpen'))}Dull blade. Sharpen it in the garage for cleaner cuts.</div>` : ''}
    </div>
  </div>`;
}

const UPGRADE_PATH = ['push21', 'trimmer', 'blower', 'selfprop', 'stripekit', 'pickup', 'walkbehind', 'pickup_trailer', 'zt48',
  'protrimmer', 'backpack', 'sharpener', 'standon', 'zt60', 'crewtruck', 'widearea', 'boxtruck', 'gangreel'];

/** The next sensible purchase with a progress bar toward it. */
function nextUpgradeCard(s: GameState): Raw | string {
  const shop = safe(() => sim.shop(s), []);
  const bestTier = (cat: string) => Math.max(-1, ...s.items.map((i) => EQUIPMENT_BY_ID[i.specId]).filter((sp) => sp && sp.category === cat).map((sp) => sp.tier));
  const next = UPGRADE_PATH.map((id) => shop.find((e) => e.spec.id === id)).find((e) => {
    if (!e || e.reason) return false;
    if (e.spec.category === 'addon') return e.owned === 0;
    return e.owned === 0 && e.spec.tier > bestTier(e.spec.category);
  });
  if (!next) return '';
  const p = clamp(s.cash / Math.max(1, next.price), 0, 1);
  return html`<div class="ui-card ui-card--flat">
    <div class="ui-card__head"><span class="ui-card__title">${raw(icon('trend'))}Next upgrade</span><button class="ui-link" data-click="nav" data-id="garage">Garage</button></div>
    <div class="ui-strong">${next.spec.name}</div>
    <div class="ui-tiny ui-muted" style="margin:2px 0 8px">${next.spec.blurb}</div>
    ${bar(p, { color: p >= 1 ? 'var(--ui-g-500)' : 'var(--ui-sun-500)' })}
    <div class="ui-row ui-small" style="justify-content:space-between;margin-top:4px"><span class="ui-strong ui-num">${money(Math.max(0, s.cash))} of ${money(next.price)}</span>
      ${p >= 1 ? html`<button class="ui-btn ui-btn--sm ui-btn--go" data-click="nav" data-id="garage">${raw(icon('cash'))}Buy</button>` : html`<span class="ui-muted">${money(next.price - Math.max(0, s.cash))} to go</span>`}</div>
  </div>`;
}

/** Today's three goals with progress and rewards. */
function goalsCard(s: GameState, where: 'main' | 'side'): Raw | string {
  const g = s.goals;
  if (!g || g.day !== s.day || !g.list.length) return '';
  const left = g.list.filter((x) => !x.done).length;
  return html`<div class="ui-card ui-card--sun ui-goals ui-goals--${where}">
    <div class="ui-card__head"><span class="ui-card__title">${raw(icon('target'))}Today's goals</span><span class="ui-small ui-strong">${left ? `${g.list.length - left} of ${g.list.length}` : 'All done'}</span></div>
    <div class="ui-col" style="gap:10px">
      ${g.list.map((x) => html`<div class="ui-goal ${x.done ? 'is-done' : ''}">
        <span class="ui-goal__ic">${raw(icon(x.done ? 'check' : 'target'))}</span>
        <div class="ui-grow"><div class="ui-small ui-strong">${x.label}</div>
          ${x.done ? '' : html`<div class="ui-row" style="gap:8px"><div class="ui-grow">${bar(x.progress / Math.max(1, x.target), { cls: 'ui-bar--thin', color: 'var(--ui-sun-600)' })}</div><span class="ui-tiny ui-num ui-strong">${x.kind === 'tips' || x.kind === 'earn' ? money(x.progress) : x.progress} / ${x.kind === 'tips' || x.kind === 'earn' ? money(x.target) : x.target}</span></div>`}
        </div>
        <span class="ui-chip ${x.done ? '' : 'ui-chip--sun'}">+${money(x.reward)}</span>
      </div>`)}
    </div>
    <div class="ui-tiny ui-muted" style="margin-top:10px">${g.sweep ? 'Clean sweep bonus earned.' : html`Clear all ${g.list.length === 2 ? 'both' : g.list.length} for a ${money(safe(() => sim.sweepBonus(s), 0))} bonus.`}</div>
  </div>`;
}

function render(): Raw {
  const s = store.state;
  const cal = calSafe(s.day);
  const tickets = safe(() => sim.jobsToday(s), [] as JobTicket[], 'jobsToday');
  const open = tickets.filter((t) => !t.done).sort((a, b) => (b.daysOverdue - a.daysOverdue) || (a.dueDay - b.dueDay));
  const done = tickets.filter((t) => t.done);
  const mineOpen = open.filter((t) => t.assignee === 'owner');
  const plans = safe(() => sim.crewPlans(s), [] as CrewPlan[], 'crewPlans');
  const issues = new Map(plans.filter((p) => !p.ready).map((p) => [p.crewId, p.problem || 'Not ready'] as [string, string]));
  const hoods = safe(() => sim.hoods(s), [], 'hoods');
  const leads = hoods.reduce((a, h) => a + (h.leads || 0), 0);
  const bids = safe(() => sim.openBids(s), [], 'openBids').filter((b) => b.status === 'open');
  const bidsToAnswer = bids.filter((b) => b.myBid === undefined).length;
  const tut = Number(s.flags?.tutorial) || 0;
  const tutorial = prefs.s.showHints && TUTORIAL[tut];
  const winter = cal.season === 'winter';
  const left = safe(() => sim.ownerMinutesLeft(s), 0);
  // rough load: each job's estimate includes travel from where you are now, so count travel once
  const work = mineOpen.reduce((a, t) => a + t.estMinutes, 0) - Math.max(0, mineOpen.length - 1) * 3;
  const net = todayNet(s);
  const wx = s.weather?.today || 'sunny';
  const days = [wx, ...(s.weather?.forecast || [])].slice(0, 4);
  const laidOff = s.staff.some((e) => e.laidOff);

  return html`
  <div class="ui-page-head">
    <div class="ui-page-head__text">
      <h1>${greeting(s.owner.minute)}</h1>
      <p>${WEEKDAYS_LONG[cal.weekday]}, ${cal.label}. ${left > 0 ? `${duration(left)} of daylight left.` : 'Out of daylight.'}</p>
    </div>
    <button class="ui-btn ui-btn--primary ui-btn--lg ui-endday" data-click="endDay">${raw(icon('moon'))}End Day<kbd class="ui-kbd ui-hide-sm">Enter</kbd></button>
  </div>

  ${(() => {
    const toGo = cal.seasonLength - cal.dayOfSeason;
    const profit = Number(s.flags?.seasonProfit) || 0;
    const tax = Math.round(profit * 0.15);
    return !winter && toGo <= 3 && tax > 0 ? html`<div class="ui-note ui-note--warn" style="margin-bottom:14px">${raw(icon('bank'))}Season taxes of about ${money(tax)} are due ${toGo === 0 ? 'tonight' : `in ${plural(toGo, 'day')}`} (15% of this season's profit). Keep some cash for them.</div>` : '';
  })()}
  ${tutorial ? html`
    <div class="ui-card ui-card--sun ui-hint" role="note">
      <span class="ui-hint__badge">${raw(icon('sparkle'))}</span>
      <div class="ui-grow"><div class="ui-hint__step">Step ${tut} of 4</div><div class="ui-hint__text">${tutorial.text}</div></div>
      ${tutorial.action ? html`<button class="ui-btn ui-btn--primary" data-click="${tutorial.action.click}">${raw(icon(tutorial.action.icon))}${tutorial.action.label}</button>` : ''}
      <button class="ui-btn ui-btn--ghost ui-btn--sm ui-btn--icon ui-hint__x" data-click="hideHints" data-tip="Hide hints" aria-label="Hide hints">${raw(icon('x'))}</button>
    </div>` : ''}

  <div class="ui-hub-stats">
    <div class="ui-stat ${net > 0 ? 'ui-stat--good' : net < 0 ? 'ui-stat--bad' : ''}"><div class="ui-stat__label">${raw(icon('cash'))}Today</div><div class="ui-stat__value">${net > 0 ? '+' : ''}${money(net)}</div></div>
    <div class="ui-stat ${work > left && mineOpen.length ? 'ui-stat--bad' : ''}" data-tip="Time your open jobs need with your kit, against the daylight left"><div class="ui-stat__label">${raw(icon('mower'))}Your jobs</div><div class="ui-stat__value">${mineOpen.length}</div><div class="ui-stat__sub">${mineOpen.length ? (work > left ? `~${duration(work)} of work, more than the day` : `~${duration(work)} of work`) : `${done.length} done`}</div></div>
    <button class="ui-stat ui-stat--link" data-click="nav" data-id="map"><div class="ui-stat__label">${raw(icon('door'))}Warm leads</div><div class="ui-stat__value">${leads}</div><div class="ui-stat__sub">Map ${raw(icon('chevR'))}</div></button>
    <button class="ui-stat ui-stat--link" data-click="bids"><div class="ui-stat__label">${raw(icon('gavel'))}Open bids</div><div class="ui-stat__value">${bids.length}</div><div class="ui-stat__sub">${bidsToAnswer ? `${bidsToAnswer} need a bid` : 'Finance'} ${raw(icon('chevR'))}</div></button>
  </div>

  ${mineOpen.length && work > left + 60 && !winter ? html`<div class="ui-note ui-note--warn" style="margin:-4px 0 14px">${raw(icon('crew'))}More lawns than you can mow before dark.${s.crews.length ? ' Assign some to a crew.' : html` <button class="ui-link" data-click="nav" data-id="crew">Hire a crew</button> to take the overflow.`}</div>` : ''}
  <div class="ui-hub-grid">
    <section class="ui-hub-main">
      ${goalsCard(s, 'main')}
      ${winter ? html`
        <div class="ui-card ui-card--sky ui-winter">
          <div class="ui-row" style="gap:14px;align-items:flex-start">
            <span class="ui-winter__ic">${raw(weatherIcon('winter'))}</span>
            <div class="ui-grow">
              <h2 style="font-size:24px">Winter</h2>
              <p class="ui-muted ui-strong" style="margin-top:2px">No growth and no mowing. Contracts pause until spring.</p>
            </div>
          </div>
          <div class="ui-row ui-row--wrap" style="margin-top:14px;gap:10px">
            <button class="ui-btn ui-btn--sky" data-click="skipWinter">${raw(icon('sunrise'))}Skip to spring</button>
            ${s.staff.length ? html`<button class="ui-btn" data-click="layoff" data-on="${laidOff ? '0' : '1'}" data-tip="Laid-off staff cost nothing. About 70 percent come back in spring.">${raw(icon('crew'))}${laidOff ? 'Bring staff back' : 'Winter layoffs'}</button>` : ''}
            ${s.items.some((i) => i.condition < 0.98) ? html`<button class="ui-btn" data-click="overhaul" data-tip="Restore equipment condition before spring">${raw(icon('wrench'))}Equipment overhaul</button>` : ''}
          </div>
        </div>` : ''}

      <h2 class="ui-section-title" id="ui-jobs">${raw(icon('mower'))}Jobs due<span class="ui-count">${open.length}</span><span class="ui-spacer"></span>
        ${mineOpen.filter((t) => t.canAutopilot).length >= 2 ? html`<button class="ui-btn ui-btn--sm ui-btn--sky" data-click="autoAll" data-tip="Autopilot every repeat lawn due today, until the day runs out.">${raw(icon('robot'))}Autopilot all (${mineOpen.filter((t) => t.canAutopilot).length})</button>` : ''}
        <button class="ui-btn ui-btn--sm ui-btn--ghost" data-click="practice" data-tip="Mow a free practice lawn. No pay, no rating.">${raw(icon('grass'))}Practice lawn</button>
      </h2>
      ${open.length
        ? html`<div class="ui-tickets">${open.map((t) => ticketCard(t, s, issues))}</div>`
        : winter
          ? emptyState('snow', 'Lawns rest until spring', 'Plan upgrades in the garage or skip ahead.')
        : !cal.isWorkday && s.clients.length
          ? emptyState('sun', 'Sunday', 'Clients do not expect service today. Knock on doors or end the day.', html`<button class="ui-btn ui-btn--go" data-click="nav" data-id="map">${raw(icon('map'))}Open the map</button>`)
          : s.clients.length
            ? emptyState('check', 'Every lawn is handled', 'Knock on more doors to grow, or end the day.', html`<button class="ui-btn ui-btn--go" data-click="nav" data-id="map">${raw(icon('door'))}Find clients</button>`)
            : emptyState('door', 'No clients yet', 'Knock on doors in Maple Grove to win your first lawn.', html`<button class="ui-btn ui-btn--go" data-click="nav" data-id="map">${raw(icon('map'))}Open the map</button>`)}
      ${done.length ? html`
        <h3 class="ui-section-title" style="font-size:18px">${raw(icon('check'))}Done today<span class="ui-count">${done.length}</span></h3>
        <div class="ui-done-list">${done.map((t) => html`<div class="ui-done">${avatar(t.portrait, t.ownerName, 34)}<div class="ui-grow"><b>${t.ownerName}</b><div class="ui-tiny ui-muted">${t.address}</div></div><span class="ui-chip">${raw(icon('check'))}${money(t.price)}</span></div>`)}</div>` : ''}
    </section>

    <aside class="ui-hub-side">
      ${goalsCard(s, 'side')}
      <div class="ui-card ui-card--flat">
        <div class="ui-card__head"><span class="ui-card__title">${raw(icon('sun'))}Forecast</span>${s.weather?.drought ? html`<span class="ui-chip ui-chip--orange">Drought</span>` : ''}</div>
        <div class="ui-forecast">
          ${days.map((w, i) => {
            const c = calSafe(s.day + i);
            return html`<div class="ui-fc ${i === 0 ? 'is-today' : ''}" data-tip="${WEATHER_NOTE[w]}">
              <span class="ui-fc__day">${i === 0 ? 'Today' : c.weekdayName}</span>
              <span class="ui-fc__ic">${raw(weatherIcon(w))}</span>
              <span class="ui-fc__lbl">${WEATHER_LABEL[w]}</span>
            </div>`;
          })}
        </div>
        <p class="ui-small ui-muted" style="margin-top:10px">${WEATHER_NOTE[wx]}</p>
      </div>

      ${s.crews.length ? html`
      <div class="ui-card ui-card--flat">
        <div class="ui-card__head"><span class="ui-card__title">${raw(icon('truck'))}Crews today</span><button class="ui-link" data-click="nav" data-id="crew">Crew</button></div>
        ${plans.length ? html`<div class="ui-col" style="gap:12px">${plans.map((p) => crewPlanCard(p, s))}</div>` : html`<p class="ui-muted ui-small">No routes planned.</p>`}
        ${s.staff.some((e) => e.role === 'office') ? html`<p class="ui-tiny ui-muted" style="margin-top:10px">Your office manager hands your leftover jobs to crews at the end of the day.</p>` : html`<button class="ui-btn ui-btn--sm ui-btn--soft ui-btn--block" style="margin-top:12px" data-click="dispatch" data-tip="Moves jobs assigned to you onto crews with room today. You can also pick a crew on each job card.">${raw(icon('route'))}Hand my due jobs to crews</button>
        <p class="ui-tiny ui-muted" style="margin-top:8px">Crews mow their routes when you end the day. Pick who does a job on its card.</p>`}
      </div>` : ''}

      ${kitCard(s)}
      ${nextUpgradeCard(s)}

      <div class="ui-card ui-card--flat ui-clockcard">
        <div class="ui-row"><span class="ui-card__title" style="font-size:17px">${raw(icon('clock'))}${clock(s.owner.minute)}</span><span class="ui-grow"></span><span class="ui-small ui-muted">${left > 0 ? `${duration(left)} left` : 'Day is over'}</span></div>
        ${bar(clamp(1 - left / 720, 0, 1), { color: left < 120 ? 'var(--ui-orange)' : 'var(--ui-sky-500)' })}
        <div class="ui-row ui-tiny ui-faint" style="justify-content:space-between;margin-top:4px"><span>7:30 AM</span><span>7:30 PM</span></div>
      </div>
    </aside>
  </div>`;
}

export const hubScreen: Screen = {
  id: 'hub',
  render,
  handlers: {
    nav: (el) => navigate(el.dataset.id || 'hub'),
    map: () => navigate('map'),
    maple: () => {
      const key = `${store.state.towns?.[0] || 'home'}.maple`;
      navigate('hood', key);
    },
    bids: () => { ui.financeTab = 'bids'; navigate('finance'); },
    scrollJobs: () => document.getElementById('ui-jobs')?.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'start' }),
    endDay: () => { void endDayFlow(); },
    hideHints: () => { prefs.update({ showHints: false }); store.commit(); },
    assign: (el) => {
      const v = (el as HTMLSelectElement).value;
      act(() => sim.assignJob(store.state, el.dataset.id || '', v), { quietOk: true });
    },
    mow: (el) => startMow(el.dataset.id || null),
    auto: (el) => runAutopilot(el.dataset.id || ''),
    autoAll: () => autopilotAllFlow(),
    practice: () => startMow(null),
    goHood: (el) => navigate('hood', el.dataset.key || ''),
    dispatch: () => act(() => sim.autoDispatch(store.state)),
    skipWinter: () => { void skipWinterFlow(); },
    layoff: (el) => act(() => sim.winterLayoff(store.state, el.dataset.on === '1')),
    overhaul: () => {
      act(() => sim.winterOverhaul(store.state));
    },
  },
};
