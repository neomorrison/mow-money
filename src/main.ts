// App entry: settings, audio, save detection, overlays, router, debug hooks.
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/title.css';
import './styles/screens.css';

import * as sim from './sim';
import { store } from './core/store';
import { loadGame } from './core/save';
import { audio } from './audio';
import { prefs } from './ui/prefs';
import { initOverlays, initClickSounds } from './ui/overlay';
import { initImageFallbacks, safe } from './ui/kit';
import { initApp, startRouting } from './ui/app';
import { navigate } from './ui/router';
import { COMPANY_COLORS, COMPANY_NAMES, startGame, debugManualJob, endDayFlow } from './ui/flows';

function boot(): void {
  const app = document.getElementById('app')!;
  const settings = prefs.load();
  try { audio.init(settings); } catch (e) { console.warn('audio init failed', e); }

  initOverlays();
  initClickSounds();
  initImageFallbacks();

  const saved = safe(() => loadGame(), null);
  if (saved) store.set(safe(() => sim.migrate(saved), saved));

  initApp(app);
  startRouting();

  // Autosave when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.saveNow(); });
  window.addEventListener('pagehide', () => store.saveNow());

  // iOS and Chrome need a user gesture before audio can play.
  const unlock = () => {
    try { audio.unlock(); } catch { /* ignore */ }
    ['touchend', 'click', 'keydown'].forEach((t) => document.removeEventListener(t, unlock, true));
  };
  ['touchend', 'click', 'keydown'].forEach((t) => document.addEventListener(t, unlock, true));

  // Block pinch zoom (iPad Safari ignores user-scalable=no). Double-tap zoom is off via touch-action: manipulation.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    const sc = (e as unknown as { scale?: number }).scale;
    if (e.touches.length > 1 && sc !== undefined && sc !== 1) e.preventDefault();
  }, { passive: false });

  // Debug hooks for headless tools (docs/ARCHITECTURE.md).
  (window as unknown as { __mm: unknown }).__mm = {
    store,
    sim,
    debug: {
      newGame(name?: string) {
        const state = sim.newGame({ companyName: name || COMPANY_NAMES[0], color: COMPANY_COLORS[0] });
        startGame(state);
        return state;
      },
      grant(cash: number) {
        if (!store.loaded) return;
        sim.debug.grantCash(store.state, cash);
        store.commit();
      },
      setDay(n: number) {
        if (!store.loaded) return;
        store.state.day = n;
        store.commit();
      },
      goto(screen: string, ...params: string[]) { navigate(screen, ...params); },
      /** Finish a manual job with synthetic measurements (tests and headless checks). */
      mowJob(clientId?: string | null, coverage?: number) { return debugManualJob(clientId ?? store.state.clients[0]?.id ?? null, coverage); },
      endDay() { void endDayFlow(); },
    },
  };
}

boot();
