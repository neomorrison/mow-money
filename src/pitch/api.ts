// The slice of the sim the pitch module uses, behind a swappable facade so the harness can run the
// neighborhood screen against a mock world while the real sim is still being built.
import * as sim from '../sim';
import { store } from '../core/store';
import type { GameState } from '../core/types';

export interface PitchApi {
  state(): GameState;
  commit(): void;
  housesInHood: typeof sim.housesInHood;
  houseView: typeof sim.houseView;
  ownerMinutesLeft: typeof sim.ownerMinutesLeft;
  fairPrice: typeof sim.fairPrice;
  knock: typeof sim.knock;
  applyPitchOutcome: typeof sim.applyPitchOutcome;
  reputation: typeof sim.reputation;
  travelMinutes: typeof sim.travelMinutes;
  jobsToday: typeof sim.jobsToday;
  calendar: typeof sim.calendar;
}

const real: PitchApi = {
  state: () => store.state,
  commit: () => store.commit(),
  housesInHood: (s, k) => sim.housesInHood(s, k),
  houseView: (s, id) => sim.houseView(s, id),
  ownerMinutesLeft: (s) => sim.ownerMinutesLeft(s),
  fairPrice: (a, f, k) => sim.fairPrice(a, f, k),
  knock: (s, id) => sim.knock(s, id),
  applyPitchOutcome: (s, id, o) => sim.applyPitchOutcome(s, id, o),
  reputation: (s) => sim.reputation(s),
  travelMinutes: (s, a, b) => sim.travelMinutes(s, a, b),
  jobsToday: (s) => sim.jobsToday(s),
  calendar: (d) => sim.calendar(d),
};

export let api: PitchApi = real;

/** Harness and tests only: replace parts of the sim facade. Pass null to restore the real sim. */
export function configurePitchApi(over: Partial<PitchApi> | null): void {
  api = over ? { ...real, ...over } : real;
}

/** Call a sim view function, returning a fallback instead of throwing (the sim may be mid-build). */
export function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch (e) { console.warn('[pitch]', (e as Error).message); return fallback; }
}
