// Step hints for the first job (spec.tutorial) and gentle tips for everyone else.
export interface TutorialView {
  moved: number;          // meters driven or walked
  areaCut: number;        // m2 cut
  coverage: number;
  trim: number;
  cleanup: number;
  tool: 1 | 2 | 3;
  hasTrimmer: boolean;
  hasBlower: boolean;
  debris: number;         // loose debris on hard surfaces right now
  flashed: boolean;
  touch: boolean;
}

interface Step { text: (v: TutorialView) => string; done: (v: TutorialView) => boolean; skip?: (v: TutorialView) => boolean }

const STEPS: Step[] = [
  { text: (v) => (v.touch ? 'Drag on the left side of the screen to drive.' : 'Drive with W A S D or the arrow keys.'), done: (v) => v.moved > 6 },
  { text: () => 'Mow the grass. Follow the faint lane lines: straight back-and-forth passes lay stripes for a bonus.', done: (v) => v.areaCut > 30 },
  { text: (v) => (v.touch ? 'Tap the eye to flash the spots you missed.' : 'Press H to flash the spots you missed.'), done: (v) => v.flashed || v.coverage > 0.7 },
  { text: () => 'Cover the whole lawn. Clients notice every missed strip.', done: (v) => v.coverage > 0.8 },
  {
    text: (v) => (v.touch ? 'Switch to the trimmer and trim the edges the mower cannot reach.' : 'Press 2 for the trimmer and trim the edges the mower cannot reach.'),
    done: (v) => v.trim > 0.75, skip: (v) => !v.hasTrimmer,
  },
  {
    text: (v) => (v.touch ? 'Switch to the blower and clear clippings off the driveway and walk.' : 'Press 3 for the blower and clear clippings off the driveway and walk.'),
    done: (v) => v.cleanup > 0.9 || v.debris < 0.5, skip: (v) => !v.hasBlower || v.debris < 0.5,
  },
  { text: (v) => (v.touch ? 'Looks good. Tap Finish when you are happy with it.' : 'Looks good. Press F or Finish when you are happy with it.'), done: () => false },
];

export class Tutorial {
  private i = 0;
  private hold = 0;
  constructor(public active: boolean) {}

  /** Returns the hint to show, or null. */
  update(v: TutorialView, dt: number): string | null {
    if (!this.active) return null;
    while (this.i < STEPS.length - 1) {
      const s = STEPS[this.i];
      if (s.skip?.(v)) { this.i++; continue; }
      if (s.done(v)) {
        this.hold += dt;
        if (this.hold > 0.6) { this.i++; this.hold = 0; continue; }
      }
      break;
    }
    return STEPS[this.i].text(v);
  }
}
