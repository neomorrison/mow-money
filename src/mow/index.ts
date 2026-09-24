// PUBLIC MOW API. OWNED BY THE MOW BUILDER. The UI mounts a 3D job into a host element.
import type { MowJobResult, MowJobSpec } from '../core/types';
import type { Settings } from '../core/save';
import { MowJob } from './job';

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

/** Debug and test handle (the harness exposes it as window.__mow). */
export interface MowDebugHandle extends MowJobHandle {
  job: MowJob;
}

/** Control reference for the settings screen (matches src/mow/input.ts). */
export interface ControlRow { action: string; keys: string; touch: string; pad: string }
export const CONTROLS: ControlRow[] = [
  { action: 'Drive', keys: 'W A S D or arrow keys', touch: 'Drag on the left side', pad: 'Left stick' },
  { action: 'Precise driving', keys: 'Hold Shift', touch: 'Short drags', pad: 'Small stick moves' },
  { action: 'Deck height', keys: 'Q lower, E raise', touch: 'Deck buttons', pad: 'Bumpers' },
  { action: 'Switch tool', keys: '1 mower, 2 trimmer, 3 blower', touch: 'Tool buttons', pad: 'A cycles, X mower' },
  { action: 'Empty the bag', keys: 'R at your vehicle', touch: 'Bag prompt', pad: 'Right bumper at your vehicle' },
  { action: 'Missed spots', keys: 'H', touch: 'Eye button', pad: 'B' },
  { action: 'Camera', keys: 'V, drag to orbit, wheel to zoom', touch: 'Camera button, drag right side, pinch', pad: 'Y, right stick' },
  { action: 'Pause', keys: 'Esc or P', touch: 'Pause button', pad: 'Start' },
  { action: 'Finish job', keys: 'F', touch: 'Finish button', pad: 'Back' },
];

export function startMowJob(host: HTMLElement, spec: MowJobSpec, cb: MowCallbacks, settings: Settings): MowJobHandle {
  const job = new MowJob(host, spec, cb, settings);
  const handle: MowDebugHandle = {
    job,
    dispose: () => job.dispose(),
    pause: (on: boolean) => job.pause(on),
  };
  return handle;
}

export type { MowJob };
