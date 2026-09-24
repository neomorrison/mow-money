// Player settings (not part of the save). Holds the live Settings object and applies it.
import { loadSettings, saveSettings, type Settings } from '../core/save';
import { audio } from '../audio';

let current: Settings = loadSettings();

export const prefs = {
  get s(): Settings { return current; },
  load(): Settings { current = loadSettings(); applyDom(); return current; },
  update(patch: Partial<Settings>): void {
    current = { ...current, ...patch };
    saveSettings(current);
    try { audio.applySettings(current); } catch { /* audio optional */ }
    applyDom();
  },
  get reducedMotion(): boolean {
    if (current.reducedMotion) return true;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  },
};

function applyDom(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ui-reduced-motion', !!current.reducedMotion);
}

// Legacy carried between runs after selling a company. UI-owned localStorage key.
const LEGACY_KEY = 'mowmoney.legacy';
export interface LegacyBank { points: number; perks: string[]; runs: number }
export function loadLegacy(): LegacyBank {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<LegacyBank>;
      return { points: Number(o.points) || 0, perks: Array.isArray(o.perks) ? o.perks.map(String) : [], runs: Number(o.runs) || 0 };
    }
  } catch { /* ignore */ }
  return { points: 0, perks: [], runs: 0 };
}
export function saveLegacy(b: LegacyBank): void {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}
