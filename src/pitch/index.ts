// PUBLIC PITCH API. OWNED BY THE PITCH BUILDER.
// mountNeighborhood renders the whole door-to-door screen for one neighborhood: the 3D diorama,
// the house card, knocking, and the negotiation overlay. It talks to the sim directly and
// calls store.commit() after every state change.
import { NeighborhoodScreen } from './screen';

export interface NeighborhoodCallbacks {
  onStartJob(clientId: string): void;   // player chose to mow a client here now
  onExit(): void;                       // back to the map
}
export interface NeighborhoodHandle { dispose(): void; refresh(): void }

export function mountNeighborhood(host: HTMLElement, hoodKey: string, cb: NeighborhoodCallbacks): NeighborhoodHandle {
  const screen = new NeighborhoodScreen(host, hoodKey, cb);
  return {
    dispose: () => screen.dispose(),
    refresh: () => screen.refresh(),
  };
}

// Extra exports for other modules and harnesses.
export { PitchScreen, type PitchScreenOptions } from './pitchScreen';
export { configurePitchApi, type PitchApi } from './api';
export { ensurePitchStyles } from './styles';
