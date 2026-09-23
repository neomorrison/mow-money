// PUBLIC AUDIO API. OWNED BY THE AUDIO BUILDER. Every call is safe before init and when files are missing.
import type { Settings } from '../core/save';

export interface LoopHandle { setVolume(v: number): void; setRate(r: number): void; stop(): void }

export const audio = {
  init(settings: Settings): void {},
  /** Call from the first user gesture (click, touchend, keydown). iOS needs it. */
  unlock(): void {},
  applySettings(settings: Settings): void {},
  play(key: string, opts?: { volume?: number; rate?: number }): void {},
  loop(key: string, opts?: { volume?: number; rate?: number }): LoopHandle {
    return { setVolume() {}, setRate() {}, stop() {} };
  },
  music(key: string | null): void {},
};
