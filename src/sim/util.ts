// Small shared helpers for the sim. Pure, no DOM.
import { makeRng, type Rng } from '../core/rng';
import type { GameState, LedgerCategory, OwnedItem, EquipmentSpec, Id } from '../core/types';
import { EQUIPMENT_BY_ID } from '../data/equipment';

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const fin = (x: number, d = 0) => (Number.isFinite(x) ? x : d);

/** Run fn with the state's rng and write the advanced state back. */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = makeRng(state.rng >>> 0);
  const out = fn(rng);
  state.rng = rng.state() >>> 0;
  return out;
}

export function newId(state: GameState, prefix: string): Id {
  state.nextId = (state.nextId || 1) + 1;
  return `${prefix}${(state.nextId - 1).toString(36)}`;
}

export function addLedger(state: GameState, amount: number, cat: LedgerCategory, note: string): void {
  const a = r2(amount);
  if (a === 0) return;
  state.cash = r2(state.cash + a);
  // Merge with a matching entry from today to keep the save small (fuel, tips, wages).
  for (let i = state.ledger.length - 1; i >= 0 && i >= state.ledger.length - 40; i--) {
    const e = state.ledger[i];
    if (e.day !== state.day) break;
    if (e.cat === cat && e.note === note && Math.sign(e.amount) === Math.sign(a)) { e.amount = r2(e.amount + a); return; }
  }
  state.ledger.push({ day: state.day, amount: a, cat, note });
}

export function hasPerk(state: GameState, id: string): boolean {
  return state.owner.perks.includes(id);
}
export function hasLegacy(state: GameState, id: string): boolean {
  return state.legacy.perks.includes(id);
}

export function itemByUid(state: GameState, uid: Id | null | undefined): OwnedItem | undefined {
  if (!uid) return undefined;
  return state.items.find((i) => i.uid === uid);
}
export function specOf(item: OwnedItem | undefined): EquipmentSpec | undefined {
  return item ? EQUIPMENT_BY_ID[item.specId] : undefined;
}
export function ownsSpec(state: GameState, specId: string): boolean {
  return state.items.some((i) => i.specId === specId);
}

export function activeStaff(state: GameState) {
  return state.staff.filter((e) => !e.laidOff);
}
export function hasRole(state: GameState, role: string): boolean {
  return state.staff.some((e) => e.role === role && !e.laidOff);
}

export function firstName(full: string): string {
  return full.split(' ')[0] || full;
}
export function lastName(full: string): string {
  const p = full.split(' ');
  return p[p.length - 1] || full;
}

export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function money0(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** Transient per-day log kept in flags (JSON string) so a mid-day reload keeps the day report intact. */
export interface DayLog {
  jobs: { clientId: Id; address: string; by: string; q: number; paid: number }[];
  newClients: { address: string; price: number; by: string }[];
  lost: { address: string; reason: string }[];
  events: string[];
}
export function readDayLog(state: GameState): DayLog {
  const raw = state.flags.dayLog;
  if (typeof raw === 'string' && raw) {
    try {
      const o = JSON.parse(raw) as Partial<DayLog>;
      return { jobs: o.jobs ?? [], newClients: o.newClients ?? [], lost: o.lost ?? [], events: o.events ?? [] };
    } catch { /* fall through */ }
  }
  return { jobs: [], newClients: [], lost: [], events: [] };
}
export function writeDayLog(state: GameState, log: DayLog): void {
  state.flags.dayLog = JSON.stringify(log);
}
export function logDay(state: GameState, fn: (log: DayLog) => void): void {
  const log = readDayLog(state);
  fn(log);
  writeDayLog(state, log);
}

export function num(state: GameState, key: string, d = 0): number {
  const v = state.flags[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}
