import type { Handlers, Raw } from './html';

export interface Screen {
  id: string;
  /** Page content for normal screens (wrapped in .ui-page). */
  render?(params: string[]): Raw;
  handlers?: Handlers;
  /** Runs after each render. first = the screen was just entered (not a state re-render). */
  after?(root: HTMLElement, first: boolean, params: string[]): void;
  /** Full-bleed screens mount their own content instead of render(). */
  mount?(host: HTMLElement, params: string[]): void;
  unmount?(): void;
  /** Called when the state changes while a full-bleed screen is shown. */
  refresh?(): void;
  /** Screen-level keys. Return true when handled. */
  onKey?(e: KeyboardEvent): boolean;
  /** Screen needs a loaded game (redirects to the title otherwise). Default true. */
  needsGame?: boolean;
  /** Hide the sidebar, status bar and tabs (title). */
  bare?: boolean;
  music?: string | null;
}
