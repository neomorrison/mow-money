// Equipment shop, garage and maintenance (docs/DESIGN.md sections 12 and 16).
import type { ActionResult, EquipmentSpec, GameState, Id, OwnedItem, ShopEntry } from '../core/types';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../data/equipment';
import { BOOK_DECAY_PER_SEASON, DAY_END, RESALE, SHARPEN_COST, SHARPEN_MINUTES, YEAR_DAYS } from './constants';
import { addLedger, hasLegacy, hasPerk, itemByUid, newId, r2, r3 } from './util';
import { canCarry, carryError, ownerKit } from './kit';
import { reputation } from './reputation';
import { ownerLevel } from './owner';
import { checkUnlocks, travelTo, travelMinutes } from './world';
import { calendar } from './calendar';

const SEASON_DAYS = YEAR_DAYS / 4;

export function priceFor(state: GameState, spec: EquipmentSpec): number {
  let p = spec.price;
  if (hasPerk(state, 'bulk_buyer')) p *= 0.9;
  if (spec.category === 'vehicle' && spec.id !== 'bike' && hasLegacy(state, 'fleet_discount')
    && !state.items.some((i) => EQUIPMENT_BY_ID[i.specId]?.category === 'vehicle' && i.specId !== 'bike')) p *= 0.75;
  return Math.round(p);
}

export function lockReason(state: GameState, spec: EquipmentSpec): string {
  const u = spec.unlock;
  if (!u) return '';
  const parts: string[] = [];
  if (u.rep !== undefined && reputation(state) < u.rep) parts.push(`${u.rep.toFixed(1)} reputation`);
  if (u.level !== undefined && ownerLevel(state).level < u.level) parts.push(`level ${u.level}`);
  if (u.hood && !state.hoods.some((k) => k.endsWith('.' + u.hood))) parts.push('a new neighborhood');
  return parts.length ? `Needs ${parts.join(' and ')}.` : '';
}

export function shop(state: GameState): ShopEntry[] {
  return EQUIPMENT.filter((s) => s.price > 0 || s.category === 'addon').map((spec) => {
    const price = priceFor(state, spec);
    const owned = state.items.filter((i) => i.specId === spec.id).length;
    let reason = lockReason(state, spec);
    if (!reason && spec.category === 'addon' && owned > 0) reason = 'Owned.';
    const canBuy = reason === '' && state.cash >= price;
    return { spec, price, owned, canBuy, reason };
  });
}

export function bookValue(state: GameState, item: OwnedItem): number {
  const seasons = Math.max(0, state.day - item.boughtDay) / SEASON_DAYS;
  return r2(item.paid * Math.pow(BOOK_DECAY_PER_SEASON, seasons));
}
export function totalBookValue(state: GameState): number {
  return r2(state.items.reduce((s, i) => s + bookValue(state, i), 0));
}

export function resaleValue(state: GameState, uid: Id): number {
  const item = itemByUid(state, uid);
  if (!item) return 0;
  return Math.round(bookValue(state, item) * RESALE);
}

export function addItem(state: GameState, specId: string, paid: number): OwnedItem {
  const item: OwnedItem = { uid: newId(state, 'i'), specId, sharpness: 1, condition: 1, hours: 0, boughtDay: state.day, paid, crewId: null };
  state.items.push(item);
  return item;
}

/** True when the item is carried by the owner. */
export function inOwnerKit(state: GameState, uid: Id): boolean {
  const o = state.owner;
  return o.mowerUid === uid || o.trimmerUid === uid || o.blowerUid === uid || o.vehicleUid === uid;
}

/** After buying a vehicle, move the best carriable garage mower into the kit. */
function refreshKitMower(state: GameState): void {
  const kit = ownerKit(state);
  let best = kit.mower;
  let bestTier = kit.mowerSpec.tier;
  for (const it of state.items) {
    const s = EQUIPMENT_BY_ID[it.specId];
    if (!s || s.category !== 'mower' || it.crewId || inOwnerKit(state, it.uid)) continue;
    if (s.tier > bestTier && canCarry(kit.vehicleSpec, s) && s.id !== 'gangreel' && s.id !== 'widearea') { best = it; bestTier = s.tier; }
  }
  if (best && best.uid !== state.owner.mowerUid) state.owner.mowerUid = best.uid;
}

export function buy(state: GameState, specId: string): ActionResult {
  const spec = EQUIPMENT_BY_ID[specId];
  if (!spec) return { ok: false, message: 'Unknown item.' };
  if (spec.price <= 0 && spec.category !== 'addon') return { ok: false, message: 'Not for sale.' };
  const lock = lockReason(state, spec);
  if (lock) return { ok: false, message: lock };
  if (spec.category === 'addon' && state.items.some((i) => i.specId === specId)) return { ok: false, message: 'Owned.' };
  const price = priceFor(state, spec);
  if (state.cash < price) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -price, 'equipment', spec.name);
  const item = addItem(state, specId, price);
  const kit = ownerKit(state);
  let where = 'In the garage.';
  if (spec.category === 'mower') {
    if (spec.tier > kit.mowerSpec.tier && canCarry(kit.vehicleSpec, spec) && spec.id !== 'gangreel' && spec.id !== 'widearea') {
      state.owner.mowerUid = item.uid; where = 'Added to your kit.';
    } else if (!canCarry(kit.vehicleSpec, spec)) where = `In the garage. ${carryError(kit.vehicleSpec, spec)}`;
  } else if (spec.category === 'trimmer') {
    if (!kit.trimmerSpec || spec.tier > kit.trimmerSpec.tier) { state.owner.trimmerUid = item.uid; where = 'Added to your kit.'; }
  } else if (spec.category === 'blower') {
    if (!kit.blowerSpec || spec.tier > kit.blowerSpec.tier) { state.owner.blowerUid = item.uid; where = 'Added to your kit.'; }
  } else if (spec.category === 'vehicle') {
    if (spec.tier > kit.vehicleSpec.tier) { state.owner.vehicleUid = item.uid; where = 'Added to your kit.'; refreshKitMower(state); }
  } else {
    where = 'Installed.';
  }
  checkUnlocks(state);
  return { ok: true, message: `Bought the ${spec.name}. ${where}` };
}

export function sell(state: GameState, uid: Id): ActionResult {
  const item = itemByUid(state, uid);
  if (!item) return { ok: false, message: 'Unknown item.' };
  const spec = EQUIPMENT_BY_ID[item.specId];
  const o = state.owner;
  if (o.mowerUid === uid) return { ok: false, message: 'Equip another mower first.' };
  if (o.vehicleUid === uid) return { ok: false, message: 'Equip another vehicle first.' };
  if (o.trimmerUid === uid) o.trimmerUid = null;
  if (o.blowerUid === uid) o.blowerUid = null;
  for (const c of state.crews) {
    if (c.vehicleUid === uid) c.vehicleUid = null;
    if (c.mowerUid === uid) c.mowerUid = null;
    if (c.trimmerUid === uid) c.trimmerUid = null;
    if (c.blowerUid === uid) c.blowerUid = null;
  }
  const value = resaleValue(state, uid);
  state.items = state.items.filter((i) => i.uid !== uid);
  if (value > 0) addLedger(state, value, 'sale', `Sold ${spec?.name ?? 'equipment'}`);
  return { ok: true, message: value > 0 ? `Sold for $${value}.` : 'Scrapped.' };
}

export function sharpen(state: GameState, uid: Id): ActionResult {
  const item = itemByUid(state, uid);
  if (!item) return { ok: false, message: 'Unknown item.' };
  const spec = EQUIPMENT_BY_ID[item.specId];
  if (spec?.category !== 'mower') return { ok: false, message: 'Only mower blades need sharpening.' };
  if (item.sharpness >= 0.995) return { ok: false, message: 'Already sharp.' };
  if (state.cash < SHARPEN_COST) return { ok: false, message: 'Not enough cash.' };
  const o = state.owner;
  const back = travelMinutes(state, o.location, 'hq');
  if (o.minute + back + SHARPEN_MINUTES > DAY_END) return { ok: false, message: 'Not enough daylight.' };
  travelTo(state, 'hq');
  o.minute += SHARPEN_MINUTES;
  addLedger(state, -SHARPEN_COST, 'repair', `Sharpened ${spec.name}`);
  item.sharpness = 1;
  return { ok: true, message: 'Blade sharpened.' };
}

export function repairCost(state: GameState, item: OwnedItem): number {
  const spec = EQUIPMENT_BY_ID[item.specId];
  const base = Math.max(spec?.price ?? 0, 150);
  let cost = 0.08 * base * Math.max(0, 1.2 - item.condition) * (item.broken ? 1.5 : 1);
  if (calendar(state.day).season === 'winter') cost *= 0.5;      // winter overhaul
  return Math.round(cost);
}

export function repair(state: GameState, uid: Id): ActionResult {
  const item = itemByUid(state, uid);
  if (!item) return { ok: false, message: 'Unknown item.' };
  if (item.condition >= 0.995 && !item.broken) return { ok: false, message: 'In top shape.' };
  const cost = repairCost(state, item);
  if (state.cash < cost) return { ok: false, message: 'Not enough cash.' };
  addLedger(state, -cost, 'repair', `Repaired ${EQUIPMENT_BY_ID[item.specId]?.name ?? 'equipment'}`);
  item.condition = 1;
  item.broken = false;
  return { ok: true, message: 'Repaired.' };
}

/** Winter overhaul (section 18): repair every worn item at the winter rate (half the repair cost). */
export function winterOverhaul(state: GameState): ActionResult {
  if (calendar(state.day).season !== 'winter') return { ok: false, message: 'Overhauls happen in winter.' };
  const worn = state.items.filter((i) => i.condition < 0.98 || i.broken).sort((a, b) => a.condition - b.condition);
  if (!worn.length) return { ok: true, message: 'Nothing needed work.' };
  let fixed = 0;
  let spent = 0;
  for (const it of worn) {
    const cost = repairCost(state, it);
    if (state.cash < cost) continue;
    const r = repair(state, it.uid);
    if (r.ok) { fixed++; spent += cost; }
  }
  if (!fixed) return { ok: false, message: 'Not enough cash.' };
  const left = worn.length - fixed;
  return { ok: true, message: `${fixed} ${fixed === 1 ? 'item' : 'items'} overhauled for $${spent}.${left ? ` ${left} left, not enough cash.` : ''}` };
}

export function equipOwner(state: GameState, uid: Id): ActionResult {
  const item = itemByUid(state, uid);
  if (!item) return { ok: false, message: 'Unknown item.' };
  const spec = EQUIPMENT_BY_ID[item.specId];
  if (!spec) return { ok: false, message: 'Unknown item.' };
  if (item.crewId) {
    const crew = state.crews.find((c) => c.id === item.crewId);
    if (crew) return { ok: false, message: `In use by ${crew.name}.` };
    item.crewId = null;
  }
  const kit = ownerKit(state);
  const o = state.owner;
  switch (spec.category) {
    case 'mower':
      if (!canCarry(kit.vehicleSpec, spec)) return { ok: false, message: carryError(kit.vehicleSpec, spec) };
      o.mowerUid = uid; break;
    case 'trimmer': o.trimmerUid = uid; break;
    case 'blower': o.blowerUid = uid; break;
    case 'vehicle':
      if (!canCarry(spec, kit.mowerSpec)) return { ok: false, message: `The ${spec.name} cannot carry the ${kit.mowerSpec.name}.` };
      o.vehicleUid = uid; break;
    default: return { ok: false, message: 'Add-ons apply automatically.' };
  }
  return { ok: true, message: `${spec.name} equipped.` };
}

/** Wear from use. */
export function wearItem(item: OwnedItem | undefined, hours: number, sharpnessLoss: number): void {
  if (!item) return;
  item.hours = r2(item.hours + Math.max(0, hours));
  item.sharpness = r3(Math.max(0, item.sharpness - Math.max(0, sharpnessLoss)));
  item.condition = r3(Math.max(0, item.condition - 0.002 * Math.max(0, hours)));
}

export function isGarageItem(state: GameState, item: OwnedItem): boolean {
  return !item.crewId && !inOwnerKit(state, item.uid);
}
