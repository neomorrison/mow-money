// Keyboard, mouse, touch (virtual joystick, orbit drag, pinch) and gamepad input for the mowing job.
export type Action = 'tool1' | 'tool2' | 'tool3' | 'deckDown' | 'deckUp' | 'missed' | 'camera' | 'pause' | 'finish' | 'cycleTool';

const KEY_ACTIONS: Record<string, Action> = {
  Digit1: 'tool1', Digit2: 'tool2', Digit3: 'tool3', Numpad1: 'tool1', Numpad2: 'tool2', Numpad3: 'tool3',
  KeyQ: 'deckDown', KeyE: 'deckUp', KeyH: 'missed', KeyV: 'camera', Escape: 'pause', KeyP: 'pause', KeyF: 'finish',
};

export interface JoystickView { show(x: number, y: number): void; move(dx: number, dy: number): void; hide(): void }

export class Input {
  keys = new Set<string>();
  actions: Action[] = [];
  /** Stick vector in screen space: x right, y up, magnitude 0..1. */
  stick = { x: 0, y: 0, active: false };
  orbitDX = 0; orbitDY = 0; zoom = 0;
  lastOrbitT = -99;
  usingTouch = false;
  usingPad = false;
  private joyId = -1;
  private joyOrigin = { x: 0, y: 0 };
  private dragId = -1;
  private dragLast = { x: 0, y: 0 };
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private padPrev: boolean[] = [];
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions | undefined][] = [];
  enabled = true;
  padEnabled = true;
  onAnyInput: (() => void) | null = null;

  constructor(private surface: HTMLElement, private joyView: JoystickView, private now: () => number) {
    const on = <K extends string>(t: EventTarget, type: K, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.listeners.push([t, type, fn as EventListener, opts]);
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
      this.usingTouch = false;
      this.onAnyInput?.();
      if (!this.keys.has(e.code)) {
        const a = KEY_ACTIONS[e.code];
        if (a && !e.repeat) this.actions.push(a);
      }
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    on(window, 'keyup', (e: KeyboardEvent) => { this.keys.delete(e.code); });
    on(window, 'blur', () => { this.keys.clear(); this.releaseJoy(); });
    on(surface, 'contextmenu', (e: Event) => e.preventDefault());
    on(surface, 'pointerdown', (e: PointerEvent) => this.down(e));
    on(window, 'pointermove', (e: PointerEvent) => this.move(e));
    on(window, 'pointerup', (e: PointerEvent) => this.up(e));
    on(window, 'pointercancel', (e: PointerEvent) => this.up(e));
    on(surface, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.zoom += Math.sign(e.deltaY) * 0.1; }, { passive: false });
  }

  private down(e: PointerEvent) {
    if (!this.enabled) return;
    this.onAnyInput?.();
    const rect = this.surface.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.usingTouch = true;
      e.preventDefault();
      // left 45 percent of the screen: joystick; elsewhere: orbit and pinch
      if (x < rect.width * 0.45 && this.joyId < 0) {
        this.joyId = e.pointerId;
        this.joyOrigin = { x: e.clientX, y: e.clientY };
        this.stick.active = true; this.stick.x = 0; this.stick.y = 0;
        this.joyView.show(x, y);
        return;
      }
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.dragId = -1;
      } else if (this.pinch.size === 1) {
        this.dragId = e.pointerId;
        this.dragLast = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (e.button === 0 || e.button === 2) {
      this.dragId = e.pointerId;
      this.dragLast = { x: e.clientX, y: e.clientY };
    }
  }
  private move(e: PointerEvent) {
    if (e.pointerId === this.joyId) {
      const dx = e.clientX - this.joyOrigin.x, dy = e.clientY - this.joyOrigin.y;
      const R = 62;
      const d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      this.stick.x = (dx * k) / R;
      this.stick.y = (-dy * k) / R;
      this.joyView.move(dx * k, dy * k);
      return;
    }
    if (this.pinch.has(e.pointerId)) {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoom -= (d - this.pinchDist) / 220;
        this.pinchDist = d;
        return;
      }
    }
    if (e.pointerId === this.dragId) {
      this.orbitDX += e.clientX - this.dragLast.x;
      this.orbitDY += e.clientY - this.dragLast.y;
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.lastOrbitT = this.now();
    }
  }
  private up(e: PointerEvent) {
    if (e.pointerId === this.joyId) this.releaseJoy();
    this.pinch.delete(e.pointerId);
    if (this.pinch.size < 2) this.pinchDist = 0;
    if (e.pointerId === this.dragId) this.dragId = -1;
  }
  private releaseJoy() {
    this.joyId = -1;
    this.stick.active = false; this.stick.x = 0; this.stick.y = 0;
    this.joyView.hide();
  }

  /** Poll the gamepad (call once per frame before reading the stick). */
  pollPad() {
    if (!this.padEnabled) return;
    // a controller shared with other apps: only listen while this page has focus
    if (typeof document !== 'undefined' && (document.hidden || (document.hasFocus && !document.hasFocus()))) return;
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) { if (this.usingPad) { this.usingPad = false; if (!this.stick.active) { this.stick.x = 0; this.stick.y = 0; } } return; }
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const lx = dz(pad.axes[0] ?? 0), ly = dz(pad.axes[1] ?? 0);
    const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
    if (lx || ly || rx || ry || pad.buttons.some((b) => b.pressed)) { this.usingPad = true; this.onAnyInput?.(); }
    if (this.usingPad && this.joyId < 0) {
      this.stick.x = lx; this.stick.y = -ly;
      this.stick.active = !!(lx || ly);
    }
    if (rx || ry) { this.orbitDX += rx * 9; this.orbitDY += ry * 6; this.lastOrbitT = this.now(); }
    const map: [number, Action][] = [[0, 'cycleTool'], [1, 'missed'], [2, 'tool1'], [3, 'camera'], [4, 'deckDown'], [5, 'deckUp'], [9, 'pause'], [8, 'finish']];
    for (const [i, a] of map) {
      const pressed = !!pad.buttons[i]?.pressed;
      if (pressed && !this.padPrev[i]) this.actions.push(a);
      this.padPrev[i] = pressed;
    }
  }

  axis(neg: string[], pos: string[]): number {
    let v = 0;
    for (const k of neg) if (this.keys.has(k)) { v -= 1; break; }
    for (const k of pos) if (this.keys.has(k)) { v += 1; break; }
    return v;
  }

  get throttle() { return this.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']); }
  /** Positive = turn left. */
  get steer() { return this.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']); }
  get slow() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get emptyBag() { return false; }

  private spare: Action[] = [];
  private orbitOut: [number, number] = [0, 0];
  /** Actions since the last call. The returned array is reused: read it before the next call. */
  takeActions(): Action[] {
    const a = this.actions;
    this.spare.length = 0;
    this.actions = this.spare;
    this.spare = a;
    return a;
  }
  /** Orbit drag since the last call (reused tuple). */
  takeOrbit(): [number, number] { this.orbitOut[0] = this.orbitDX; this.orbitOut[1] = this.orbitDY; this.orbitDX = 0; this.orbitDY = 0; return this.orbitOut; }
  takeZoom(): number { const z = this.zoom; this.zoom = 0; return z; }

  dispose() {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
  }
}
