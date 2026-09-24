// Finance: loans, insurance, taxes, summaries, valuation (docs/DESIGN.md section 16).
import type { ActionResult, GameState, Id, LedgerCategory, LoanOffer, ValuationBreakdown } from '../core/types';
import { clamp } from '../core/rng';
import { INSURANCE_BASE, INSURANCE_PER_EMPLOYEE, LOAN_TERMS, YEAR_DAYS } from './constants';
import { addLedger, hasPerk, newId, r2 } from './util';
import { reputation } from './reputation';
import { totalBookValue } from './shop';
import { checkUnlocks } from './world';

/** Categories that are capital flows, not operating income or cost. */
export const CAPITAL: LedgerCategory[] = ['equipment', 'sale', 'loan', 'branch'];

export function isOperating(e: { cat: LedgerCategory; note: string }): boolean {
  if (CAPITAL.includes(e.cat)) return false;
  if (e.cat === 'loan_payment') return e.note === 'Loan interest';
  return true;
}

export function debt(state: GameState): number {
  return r2(state.loans.reduce((s, l) => s + l.balance, 0));
}

export function financeSummary(state: GameState, lastDays: number): { revenue: number; expenses: number; net: number; byCategory: Record<string, number> } {
  const from = state.day - Math.max(1, lastDays) + 1;
  let revenue = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};
  for (const e of state.ledger) {
    if (e.day < from) continue;
    byCategory[e.cat] = r2((byCategory[e.cat] ?? 0) + e.amount);
    if (e.amount > 0) revenue += e.amount;
    else expenses -= e.amount;
  }
  return { revenue: r2(revenue), expenses: r2(expenses), net: r2(revenue - expenses), byCategory };
}

function avgWeeklyRevenue(state: GameState): number {
  const recent = state.days.slice(-28);
  if (!recent.length) return 0;
  const sum = recent.reduce((s, d) => s + d.revenue, 0);
  return (sum / recent.length) * 7;
}

export function loanApr(state: GameState): number {
  let apr = reputation(state) >= 4.5 ? 0.07 : 0.09;
  if (hasPerk(state, 'negotiator')) apr -= 0.02;
  return Math.max(0.03, apr);
}

export function loanOffer(state: GameState): LoanOffer {
  const limit = 2000 + 0.5 * totalBookValue(state) + 4 * avgWeeklyRevenue(state) - debt(state);
  return { limit: Math.max(0, Math.floor(limit / 50) * 50), apr: loanApr(state), terms: [...LOAN_TERMS] };
}

export function weeklyPayment(amount: number, apr: number, weeks: number): number {
  const i = apr / 52;
  if (i <= 0) return amount / weeks;
  return (amount * i) / (1 - Math.pow(1 + i, -weeks));
}

export function takeLoan(state: GameState, amount: number, weeks: number): ActionResult {
  const offer = loanOffer(state);
  if (!Number.isFinite(amount) || amount < 100) return { ok: false, message: 'Borrow at least $100.' };
  if (!LOAN_TERMS.includes(weeks)) return { ok: false, message: 'Pick a term of 13, 26 or 52 weeks.' };
  if (amount > offer.limit) return { ok: false, message: `The bank limit is $${offer.limit.toLocaleString('en-US')}.` };
  const amt = Math.round(amount);
  const pay = r2(weeklyPayment(amt, offer.apr, weeks));
  state.loans.push({ id: newId(state, 'l'), principal: amt, balance: amt, apr: offer.apr, weeklyPayment: pay, weeksLeft: weeks, takenDay: state.day });
  addLedger(state, amt, 'loan', `Loan, ${weeks} weeks`);
  return { ok: true, message: `Borrowed $${amt.toLocaleString('en-US')}. $${pay.toFixed(2)} a week.` };
}

export function repayLoan(state: GameState, loanId: Id, amount: number): ActionResult {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, message: 'Unknown loan.' };
  const amt = r2(Math.min(loan.balance, Number.isFinite(amount) ? amount : loan.balance));
  if (amt <= 0) return { ok: false, message: 'Enter an amount.' };
  if (state.cash < amt) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -amt, 'loan_payment', 'Loan principal');
  loan.balance = r2(loan.balance - amt);
  if (loan.balance <= 0.01) {
    state.loans = state.loans.filter((l) => l !== loan);
    state.flags.loansRepaid = (Number(state.flags.loansRepaid) || 0) + 1;
    return { ok: true, message: 'Loan paid off.' };
  }
  return { ok: true, message: `Paid $${amt.toFixed(2)}.` };
}

/** Weekly loan service (Mondays). */
export function payLoans(state: GameState): void {
  for (const loan of [...state.loans]) {
    const i = loan.apr / 52;
    const interest = r2(loan.balance * i);
    const principal = r2(Math.min(loan.balance, Math.max(0, loan.weeklyPayment - interest)));
    addLedger(state, -interest, 'loan_payment', 'Loan interest');
    addLedger(state, -principal, 'loan_payment', 'Loan principal');
    loan.balance = r2(loan.balance - principal);
    loan.weeksLeft = Math.max(0, loan.weeksLeft - 1);
    if (loan.balance <= 0.01 || loan.weeksLeft <= 0) {
      if (loan.balance > 0.01) addLedger(state, -loan.balance, 'loan_payment', 'Loan principal');
      state.loans = state.loans.filter((l) => l !== loan);
      state.flags.loansRepaid = (Number(state.flags.loansRepaid) || 0) + 1;
    }
  }
}

export function insuranceWeekly(state: GameState): number {
  return INSURANCE_BASE + INSURANCE_PER_EMPLOYEE * state.staff.filter((e) => !e.laidOff).length;
}

export function setInsurance(state: GameState, on: boolean): ActionResult {
  if (on === state.insured) return { ok: true, message: on ? 'Already insured.' : 'Not insured.' };
  if (!on) {
    if (state.staff.length) return { ok: false, message: 'Employees need insurance.' };
    if (state.clients.some((c) => c.commercial)) return { ok: false, message: 'Contracts need insurance.' };
    state.insured = false;
    return { ok: true, message: 'Insurance canceled.' };
  }
  const first = insuranceWeekly(state);
  if (state.cash < first) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -first, 'insurance', 'Insurance, first week');
  state.insured = true;
  state.flags.insPaidDay = state.day;
  checkUnlocks(state);
  return { ok: true, message: `Insured. $${first} a week.` };
}

export function payInsurance(state: GameState): void {
  if (!state.insured) return;
  if (state.flags.insPaidDay === state.day) return;
  addLedger(state, -insuranceWeekly(state), 'insurance', 'Insurance');
  state.flags.insPaidDay = state.day;
}

/** Operating profit over the trailing year of day summaries, scaled to 98 days. */
export function annualProfit(state: GameState): number {
  const recent = state.days.slice(-YEAR_DAYS);
  if (!recent.length) return 0;
  const net = recent.reduce((s, d) => s + d.net, 0);
  if (recent.length >= YEAR_DAYS) return net;
  // Less than a year of history: extrapolate the last 28 days, as the design says.
  const last = recent.slice(-28);
  const n = last.reduce((s, d) => s + d.net, 0);
  return (n / last.length) * YEAR_DAYS;
}

export function retention(state: GameState): number {
  const since = state.day - 28;
  const lost = state.lost.filter((l) => l.day > since && !l.reason.startsWith('Contract')).length;
  const kept = state.clients.filter((c) => c.since <= since).length;
  const base = kept + lost;
  if (base <= 0) return 0.8;
  return clamp(kept / base, 0, 1);
}

export function valuation(state: GameState): ValuationBreakdown {
  const ap = annualProfit(state);
  const ret = retention(state);
  const rep = reputation(state);
  const multiple = 1.5 + 0.45 * rep + ret;
  const bookValue = totalBookValue(state);
  const d = debt(state);
  const total = Math.max(0, ap) * multiple + bookValue + state.cash - d;
  return {
    total: Math.round(total), annualProfit: Math.round(ap), multiple: Math.round(multiple * 100) / 100,
    bookValue: Math.round(bookValue), cash: Math.round(state.cash), debt: Math.round(d), retention: Math.round(ret * 1000) / 1000,
  };
}
