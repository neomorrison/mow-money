// PUBLIC MOW API. OWNED BY THE MOW BUILDER. The UI mounts a 3D job into a host element.
import type { MowJobResult, MowJobSpec } from '../core/types';
import type { Settings } from '../core/save';

export interface MowCallbacks {
  /** The player pressed Finish (or the job auto-finished). result.completed = true. */
  onFinish(result: MowJobResult): void;
  /** The player left without finishing. Nothing is paid; the clock still advances by gameMinutes. */
  onAbandon(result: MowJobResult): void;
}

export interface MowJobHandle {
  dispose(): void;          // stop the loop, free GPU resources, remove DOM
  pause(on: boolean): void;
}

export function startMowJob(host: HTMLElement, spec: MowJobSpec, cb: MowCallbacks, settings: Settings): MowJobHandle {
  host.innerHTML = '<div style="padding:40px;color:#fff">The mowing scene is being built.</div>';
  return { dispose() { host.innerHTML = ''; }, pause() {} };
}
