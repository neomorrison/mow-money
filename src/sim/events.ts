// Random daily events: HOA letters, viral reviews, fuel spikes, client vacations, rival price wars.
import type { GameState } from '../core/types';
import type { Rng } from '../core/rng';
import { HOOD_BY_ID, splitHoodKey } from '../data/hoods';
import { FUEL_MAX } from './constants';
import { hoaLetter, makeLead } from './market';
import { clientForHouse, hoodHouses, houseHoodKey, houseInfo, isCold, isLead } from './world';
import { calendar } from './calendar';
import { lastName, r2 } from './util';

export function rollEvents(state: GameState, rng: Rng): string[] {
  const out: string[] = [];
  const cal = calendar(state.day);
  if (cal.season === 'winter') return out;
  if (!rng.chance(0.14)) return out;
  const kind = rng.weighted(['hoa', 'viral', 'fuel', 'vacation', 'pricewar'] as const, (k) => ({ hoa: 3, viral: 2, fuel: 1.5, vacation: 3, pricewar: 1 }[k]));
  switch (kind) {
    case 'hoa': {
      const line = hoaLetter(state, rng);
      if (line) out.push(line);
      break;
    }
    case 'viral': {
      const great = state.clients.filter((c) => c.lastQ >= 90 && !c.commercial);
      if (!great.length) break;
      const c = rng.pick(great);
      const key = houseHoodKey(c.houseId);
      const pool = hoodHouses(state, key).filter((h) => !clientForHouse(state, h.id) && !isLead(state, state.houses[h.id]) && !isCold(state, state.houses[h.id]));
      const n = Math.min(pool.length, rng.int(2, 4));
      for (let i = 0; i < n; i++) {
        const h = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
        makeLead(state, h.id, 0.2);
      }
      if (n) {
        const hood = HOOD_BY_ID[splitHoodKey(key).hoodId];
        out.push(`${houseInfo(state, c.houseId).ownerName} posted photos of their lawn. ${n} neighbors in ${hood?.name ?? 'the area'} want a quote.`);
      }
      break;
    }
    case 'fuel': {
      state.weather.fuelPrice = r2(Math.min(FUEL_MAX, state.weather.fuelPrice * rng.range(1.12, 1.25)));
      out.push(`Fuel prices jumped to $${state.weather.fuelPrice.toFixed(2)} a gallon.`);
      break;
    }
    case 'vacation': {
      const list = state.clients.filter((c) => !c.commercial && c.status === 'active' && c.visits > 0);
      if (!list.length) break;
      const c = rng.pick(list);
      c.nextDueDay = Math.max(c.nextDueDay, state.day) + 7;
      out.push(`The ${lastName(houseInfo(state, c.houseId).ownerName)} family is on vacation. Their next visit moves a week.`);
      break;
    }
    case 'pricewar': {
      const townId = rng.pick(state.towns);
      const rivals = state.rivals[townId] ?? [];
      const budget = rivals[0];
      if (!budget || (budget.priceWarUntil ?? -1) >= state.day) break;
      budget.priceWarUntil = state.day + 10;
      out.push(`${budget.name} slashed prices for 10 days. Unhappy clients may jump ship.`);
      break;
    }
  }
  return out;
}
