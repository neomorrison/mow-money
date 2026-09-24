// End of day: the daily simulation step (docs/DESIGN.md sections 2, 10, 11, 14, 15, 16, 18).
import type { ActionResult, DayReport, DaySummary, GameState, LedgerCategory } from '../core/types';
import { clamp } from '../core/rng';
import { DAY_START, TAX_RATE, FUEL_MIN, FUEL_MAX } from './constants';
import { calendar, seasonLabel } from './calendar';
import { addLedger, hasRole, num, r1, r2, readDayLog, withRng } from './util';
import { reputation } from './reputation';
import { growOnce, growAvgDays } from './growth';
import { advanceWeather } from './weather';
import { autoDispatch, runCrews, overnightMaintenance } from './crews';
import { runSalesReps, payWages, driftMorale, weeklyQuits, refreshCandidates } from './staff';
import { clientRivalMult, hDayFromWeek, hWeek, latenessPenalty, removeClient } from './clients';
import { rollLeads, rollReferrals, resolveBids, spawnBids, tickContracts } from './market';
import { payLoans, payInsurance, isOperating } from './finance';
import { rollEvents } from './events';
import { checkAchievements } from './achievements';
import { checkUnlocks, houseInfo, hs } from './world';

function emptyReport(state: GameState): DayReport {
  const cal = calendar(state.day);
  return {
    day: state.day, label: cal.label, revenue: 0, expenses: 0, net: 0, lines: [], jobs: [], missed: [], newClients: [],
    lostClients: [], referrals: [], staff: [], events: [], repBefore: reputation(state), repAfter: reputation(state),
    cashEnd: state.cash, weatherTomorrow: state.weather.forecast[0] ?? state.weather.today, seasonChanged: null, achievements: [],
  };
}

export function endDay(state: GameState): DayReport {
  const report = emptyReport(state);
  const cal = calendar(state.day);
  const nextCal = calendar(state.day + 1);
  const winter = cal.season === 'winter';
  const storm = state.weather.today === 'storm';

  withRng(state, (rng) => {
    // 1. Crews work.
    if (!winter && cal.isWorkday) {
      if (hasRole(state, 'office') && state.crews.length) autoDispatch(state);
      const cr = runCrews(state, rng);
      report.jobs.push(...cr.jobs);
      report.missed.push(...cr.missed);
      report.staff.push(...cr.staff);
    }
    // 2. Sales reps.
    if (!winter) {
      const sr = runSalesReps(state, rng);
      report.staff.push(...sr.lines);
    }
    // 3. Grow grass on client lawns (tracked daily with today's weather).
    for (const c of state.clients) {
      const h = hs(state, c.houseId);
      let cur = typeof h.h === 'number' && Number.isFinite(h.h) ? h.h : 3;
      const from = typeof h.hDay === 'number' ? h.hDay : state.day;
      if (from < state.day) cur = growAvgDays(cur, from, state.day);
      cur = growOnce(cur, cal.season, state.weather.today, c.addOns.includes('fertilizer'), state.weather.drought);
      h.h = r2(cur);
      h.hDay = state.day + 1;
    }
    // 4. Lateness penalties and missed owner jobs.
    if (!winter) {
      for (const c of state.clients) {
        if (c.status !== 'active' || c.lastServiceDay === state.day) continue;
        if (c.nextDueDay <= state.day && c.assignee === 'owner' && !report.missed.some((m) => m.clientId === c.id)) {
          report.missed.push({ clientId: c.id, address: houseInfo(state, c.houseId).address, reason: storm ? 'Storm' : 'Not done' });
        }
        if (state.day > c.nextDueDay + 1 && cal.weekday !== 6 && !storm) {
          c.satisfaction = r1(clamp(c.satisfaction - latenessPenalty(c), 0, 100));
        }
      }
    }
    // 5. Churn hazard.
    if (!winter) {
      for (const c of [...state.clients]) {
        if (c.commercial || c.visits === 0 && c.trial) continue;
        const p = Math.min(0.95, hDayFromWeek(hWeek(c.satisfaction)) * clientRivalMult(state, c));
        if (rng.chance(p)) {
          const reason = c.satisfaction < 40 ? 'Unhappy with the service' : c.price > c.R ? 'Found a cheaper option' : 'Decided to switch';
          removeClient(state, c, reason, rng);
        }
      }
    }
    // 6. Leads.
    if (!winter) rollLeads(state, rng);
    // 7. Weekly (Sunday): referrals, price check, contract terms, quits.
    if (cal.weekday === 6) {
      if (!winter) {
        report.referrals.push(...rollReferrals(state, rng));
        for (const c of state.clients) {
          if (c.commercial || c.R <= 0) continue;
          const over = Math.max(0, c.price / c.R - 1);
          if (over > 0) c.satisfaction = r1(clamp(c.satisfaction - 15 * over, 0, 100));
        }
        tickContracts(state, rng, (c, reason) => removeClient(state, c, reason, null, true));
      }
      report.staff.push(...weeklyQuits(state, rng));
    }
    // 8. Wages on workdays.
    if (cal.isWorkday) payWages(state);
    // 9. Morale.
    driftMorale(state);
    // 10. Monday items happen as the new week starts.
    if (nextCal.weekday === 0) {
      refreshCandidates(state, rng);
      payLoans(state);
      payInsurance(state);
      const w = state.weather;
      w.fuelPrice = r2(clamp(w.fuelPrice * (1 + rng.normal(0, 0.04)), FUEL_MIN, FUEL_MAX));
    }
    // 11. Bids.
    const bids = resolveBids(state, rng);
    report.events.push(...bids.events);
    report.events.push(...spawnBids(state, rng));
    // 12. Events.
    report.events.push(...rollEvents(state, rng));
    // 13. Overnight maintenance.
    report.events.push(...overnightMaintenance(state));
    // 14. Overdraft.
    if (state.cash < 0) addLedger(state, -Math.max(2, Math.abs(state.cash) * 0.001), 'other_out', 'Overdraft fee');

    // 15. Season accounting and change.
    const todays = state.ledger.filter((e) => e.day === state.day);
    const opNet = todays.filter((e) => isOperating(e) && e.cat !== 'tax').reduce((s, e) => s + e.amount, 0);
    state.flags.seasonProfit = r2(num(state, 'seasonProfit') + opNet);
    if (nextCal.season !== cal.season) {
      report.seasonChanged = nextCal.season;
      const profit = num(state, 'seasonProfit');
      if (profit > 0) addLedger(state, -profit * TAX_RATE, 'tax', `Taxes, ${seasonLabel(cal.season)}`);
      state.flags.seasonProfit = 0;
      if (nextCal.season === 'winter') {
        const springDay = state.day + 1 + 14;
        for (const c of state.clients) c.nextDueDay = springDay;
        report.events.push('Winter is here. Contracts pause until spring.');
      }
      if (nextCal.season === 'spring') {
        let lost = 0;
        for (const c of [...state.clients]) {
          c.nextDueDay = state.day + 1;
          if (c.commercial) continue;
          const renew = Math.pow(1 - hWeek(c.satisfaction), 2);
          if (!rng.chance(renew)) { removeClient(state, c, 'Did not renew', rng); lost++; }
        }
        report.events.push(lost ? `Spring renewals: ${lost} ${lost === 1 ? 'client' : 'clients'} did not renew.` : 'Spring renewals: every client renewed.');
        for (const e of [...state.staff]) {
          if (!e.laidOff) continue;
          const back = rng.chance(clamp(0.5 + 0.4 * e.morale / 100, 0, 0.95));
          if (back) { e.laidOff = false; report.staff.push({ name: e.name, event: 'Back for the season.' }); }
          else {
            for (const cr of state.crews) cr.memberIds = cr.memberIds.filter((id) => id !== e.id);
            state.staff = state.staff.filter((x) => x !== e);
            report.staff.push({ name: e.name, event: 'Did not come back after winter.' });
          }
        }
      }
    }
    // 16. Weather for tomorrow.
    advanceWeather(rng, state.weather, state.day + 1);
  });

  // 17. Unlocks and achievements.
  for (const name of checkUnlocks(state)) report.events.push(`Unlocked: ${name}.`);
  if ((Number(state.flags.tutorial) || 0) === 4) state.flags.tutorial = 0;

  // 18. Summary.
  const log = readDayLog(state);
  report.jobs.unshift(...log.jobs);
  report.newClients.push(...log.newClients);
  report.lostClients.push(...log.lost);
  report.events.unshift(...log.events);
  const todays = state.ledger.filter((e) => e.day === state.day);
  const agg = new Map<string, { cat: LedgerCategory; amount: number; note: string }>();
  for (const e of todays) {
    const k = `${e.cat}|${e.note}`;
    const a = agg.get(k);
    if (a) a.amount = r2(a.amount + e.amount);
    else agg.set(k, { cat: e.cat, amount: e.amount, note: e.note });
  }
  report.lines = [...agg.values()];
  let revenue = 0;
  let expenses = 0;
  for (const e of todays) {
    if (!isOperating(e)) continue;
    if (e.amount > 0) revenue += e.amount; else expenses -= e.amount;
  }
  report.revenue = r2(revenue);
  report.expenses = r2(expenses);
  report.net = r2(revenue - expenses);
  report.repAfter = reputation(state);
  report.cashEnd = r2(state.cash);
  report.weatherTomorrow = state.weather.today;
  const qs = report.jobs.map((j) => j.q);
  const summary: DaySummary = {
    day: state.day, revenue: report.revenue, expenses: report.expenses, net: report.net, jobs: report.jobs.length,
    avgQ: qs.length ? r1(qs.reduce((s, q) => s + q, 0) / qs.length) : 0, newClients: report.newClients.length,
    lostClients: report.lostClients.length, cashEnd: report.cashEnd, rep: Math.round(report.repAfter * 100) / 100, clients: state.clients.length,
  };
  state.days.push(summary);
  if (state.days.length > 120) state.days.splice(0, state.days.length - 120);
  state.ledger = state.ledger.filter((e) => e.day > state.day - 30);
  if (state.lost.length > 40) state.lost.splice(0, state.lost.length - 40);
  state.marketing = state.marketing.filter((m) => m.endDay >= state.day);
  // Transient flags.
  for (const k of Object.keys(state.flags)) if (k.startsWith('ys:')) delete state.flags[k];
  delete state.flags.dayLog;
  // Forget stale per-house state for houses nobody cares about any more.
  for (const id of Object.keys(state.houses)) {
    const h = state.houses[id];
    if (h.lastKnockDay !== undefined && state.day - h.lastKnockDay > 30) delete h.lastKnockDay;
    if (h.hoaUntil !== undefined && h.hoaUntil < state.day) delete h.hoaUntil;
    if (h.leadUntil !== undefined && h.leadUntil < state.day) { delete h.leadUntil; delete h.leadTrust; }
    if (h.coldUntil !== undefined && h.coldUntil <= state.day) delete h.coldUntil;
    if (h.provider === 'me' || h.yardSign || h.exClient) continue;
    const stale = (h.leadUntil ?? -1) < state.day && (h.coldUntil ?? -1) <= state.day + 1 && (h.hoaUntil ?? -1) < state.day
      && (h.hDay === undefined || state.day - h.hDay > 30) && (h.lastKnockDay === undefined || state.day - h.lastKnockDay > 30);
    if (stale && !state.clients.some((c) => c.houseId === id)) delete state.houses[id];
  }

  // 19. Next morning.
  state.day += 1;
  state.owner.minute = DAY_START;
  state.owner.location = 'hq';
  state.owner.jobsToday = 0;
  report.achievements = checkAchievements(state);
  return report;
}

export function skipWinter(state: GameState): DayReport {
  if (calendar(state.day).season !== 'winter') {
    const r = emptyReport(state);
    r.events.push('Skip is only available in winter.');
    return r;
  }
  const first = emptyReport(state);
  const lines = new Map<string, { cat: LedgerCategory; amount: number; note: string }>();
  let guard = 0;
  let last: DayReport | null = null;
  while (calendar(state.day).season === 'winter' && guard++ < 20) {
    const r = endDay(state);
    last = r;
    first.revenue = r2(first.revenue + r.revenue);
    first.expenses = r2(first.expenses + r.expenses);
    for (const l of r.lines) {
      const k = `${l.cat}|${l.note}`;
      const a = lines.get(k);
      if (a) a.amount = r2(a.amount + l.amount); else lines.set(k, { ...l });
    }
    first.jobs.push(...r.jobs);
    first.missed.push(...r.missed);
    first.newClients.push(...r.newClients);
    first.lostClients.push(...r.lostClients);
    first.referrals.push(...r.referrals);
    first.staff.push(...r.staff);
    first.events.push(...r.events);
    first.achievements.push(...r.achievements);
    if (r.seasonChanged) first.seasonChanged = r.seasonChanged;
  }
  first.lines = [...lines.values()];
  first.net = r2(first.revenue - first.expenses);
  first.label = `Winter, Year ${calendar(first.day).year}`;
  if (last) {
    first.repAfter = last.repAfter;
    first.cashEnd = last.cashEnd;
    first.weatherTomorrow = last.weatherTomorrow;
  }
  return first;
}

export function winterLayoff(state: GameState, on: boolean): ActionResult {
  if (on && calendar(state.day).season !== 'winter') return { ok: false, message: 'Layoffs are only for winter.' };
  let n = 0;
  for (const e of state.staff) {
    if (e.laidOff === on) continue;
    e.laidOff = on;
    if (!on) e.morale = r1(clamp(e.morale - 5, 0, 100));
    n++;
  }
  if (!n) return { ok: true, message: on ? 'Nobody to lay off.' : 'Nobody to bring back.' };
  return { ok: true, message: on ? `${n} laid off until spring. About 70% usually come back.` : `${n} back on the payroll.` };
}
