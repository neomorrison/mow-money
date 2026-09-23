// PUBLIC PITCH API. OWNED BY THE PITCH BUILDER.
// mountNeighborhood renders the whole door-to-door screen for one neighborhood: the 3D diorama,
// the house card, knocking, and the negotiation overlay. It talks to the sim directly and
// calls store.commit() after every state change.
export interface NeighborhoodCallbacks {
  onStartJob(clientId: string): void;   // player chose to mow a client here now
  onExit(): void;                       // back to the map
}
export interface NeighborhoodHandle { dispose(): void; refresh(): void }

export function mountNeighborhood(host: HTMLElement, hoodKey: string, cb: NeighborhoodCallbacks): NeighborhoodHandle {
  host.innerHTML = '<div style="padding:40px">This neighborhood is being built.</div>';
  return { dispose() { host.innerHTML = ''; }, refresh() {} };
}
