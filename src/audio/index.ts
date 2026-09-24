// PUBLIC AUDIO API. OWNED BY THE AUDIO BUILDER. Every call is safe before init, before
// unlock, and when a file is missing, still loading or fails to decode: this module never
// throws into a caller and the game must feel the same with or without art/audio/*.
//
// Architecture: one AudioContext, three gain buses (master -> music/sfx), driven by
// Settings.master/music/sfx. Real files are fetched from src/data/assets.ts's audioUrl(key)
// and decoded once into a shared buffer cache. Missing/failed/still-loading keys fall back
// to the procedural synths in ./synth.ts so nothing is ever silent. If a real buffer finishes
// loading while a loop or the current music track is already playing on the fallback, the
// voice hot-swaps to the real buffer with a short crossfade.
import type { Settings } from '../core/save';
import { audioUrl, SFX_KEYS, MUSIC_KEYS } from '../data/assets';
import { bus } from '../core/bus';
import { playFallback, startFallbackLoop, startFallbackMusic, isKnownLoop, isKnownMusic, type FallbackLoopHandle } from './synth';

export interface LoopHandle { setVolume(v: number): void; setRate(r: number): void; stop(): void }

type CacheEntry = { buffer: AudioBuffer | null; promise: Promise<AudioBuffer | null> | null; failed: boolean };

const ALL_KEYS = new Set<string>([...SFX_KEYS, ...MUSIC_KEYS]);
const UI_JITTER_KEYS = new Set(['click', 'hover', 'knock', 'cash', 'tip', 'cut_crunch', 'bump']);
const RATE_RAMP = 0.06;
const VOL_RAMP = 0.05;
const STOP_FADE = 0.18;
const MUSIC_FADE = 1.1;

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** One playing loop or music track. Wraps either a real looping buffer or a synth fallback,
 * and can swap from fallback to real once the file finishes loading. */
class Voice {
  private ctx: AudioContext;
  private bus: GainNode;
  private out: GainNode; // per-voice volume, feeds `bus`
  readonly key: string;
  private rate = 1;
  private volume = 1;
  private source: AudioBufferSourceNode | null = null;
  private fallback: FallbackLoopHandle | null = null;
  private usingFallback = false;
  private stopped = false;
  private isMusic: boolean;

  constructor(ctx: AudioContext, destBus: GainNode, key: string, isMusic: boolean) {
    this.ctx = ctx;
    this.bus = destBus;
    this.key = key;
    this.isMusic = isMusic;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destBus);
  }

  startWithBuffer(buf: AudioBuffer, fadeIn: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = this.rate;
    src.connect(this.out);
    src.start(0);
    this.source = src;
    this.usingFallback = false;
    this.rampTo(this.volume, fadeIn);
  }

  startWithFallback(fadeIn: number) {
    const builder = this.isMusic ? startFallbackMusic : startFallbackLoop;
    this.fallback = builder(this.ctx, this.out, this.key);
    this.usingFallback = true;
    this.rampTo(this.volume, fadeIn);
  }

  /** Called once a real buffer finishes loading; only takes effect if still using the fallback
   * for this exact key and not already stopped. */
  swapToBuffer(buf: AudioBuffer) {
    if (this.stopped || !this.usingFallback) return;
    const oldFallback = this.fallback;
    const oldOut = this.out;
    // crossfade: fade the fallback's shared `out` down is wrong (it would kill the new sound
    // too, since both share `out`), so give the incoming buffer its own gain and crossfade
    // between two gains both feeding `bus`.
    const bridgeOut = this.ctx.createGain();
    bridgeOut.gain.value = 0;
    bridgeOut.connect(this.bus);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = this.rate;
    src.connect(bridgeOut);
    src.start(0);
    const t = this.ctx.currentTime;
    bridgeOut.gain.setTargetAtTime(this.volume, t, 0.4);
    oldOut.gain.setTargetAtTime(0.0001, t, 0.4);
    this.source = src;
    this.out = bridgeOut;
    this.usingFallback = false;
    this.fallback = null;
    setTimeout(() => {
      try { oldFallback?.stop(); } catch { /* noop */ }
      try { oldOut.disconnect(); } catch { /* noop */ }
    }, 900);
  }

  setVolume(v: number) {
    this.volume = clamp01(v);
    if (!this.stopped) this.rampTo(this.volume, VOL_RAMP);
  }

  setRate(r: number) {
    this.rate = Math.max(0.25, Math.min(3, r));
    if (this.source) this.source.playbackRate.setTargetAtTime(this.rate, this.ctx.currentTime, RATE_RAMP);
    this.fallback?.setRate(this.rate);
  }

  private rampTo(v: number, time: number) {
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, Math.max(time, 0.01) / 3);
  }

  stop(fade = STOP_FADE) {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, Math.max(fade, 0.01) / 3);
    const src = this.source;
    const fb = this.fallback;
    const out = this.out;
    setTimeout(() => {
      try { src?.stop(); } catch { /* noop */ }
      try { src?.disconnect(); } catch { /* noop */ }
      try { fb?.stop(); } catch { /* noop */ }
      try { out.disconnect(); } catch { /* noop */ }
    }, Math.ceil(fade * 1000) + 60);
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private settings: Settings | null = null;
  private cache = new Map<string, CacheEntry>();
  private activeLoops = new Set<Voice>();
  private currentMusicKey: string | null = null;
  private currentMusicVoice: Voice | null = null;
  private unlocked = false;
  private unlockAttached = false;
  private visibilityAttached = false;
  private visibilityMuted = false;
  private preloadStarted = false;

  // ---------------------------------------------------------------- lifecycle

  init(settings: Settings): void {
    this.settings = settings;
    this.ensureContext();
    this.attachVisibilityHandler();
    this.attachBusHandlers();
    this.preload();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      const ctx: AudioContext = new Ctor();
      const master = ctx.createGain();
      const musicBus = ctx.createGain();
      const sfxBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
      this.applyGains();
      return ctx;
    } catch (e) {
      console.warn('[audio] Web Audio unavailable', e);
      this.ctx = null;
      return null;
    }
  }

  private attachBusHandlers(): void {
    // Decoupled path: any module can bus.emit('sfx', {key, volume}) / bus.emit('music', {key})
    // instead of importing this module directly.
    bus.on('sfx', ({ key, volume }) => this.play(key, { volume }));
    bus.on('music', ({ key }) => this.music(key));
  }

  private attachVisibilityHandler(): void {
    if (this.visibilityAttached || typeof document === 'undefined') return;
    this.visibilityAttached = true;
    document.addEventListener('visibilitychange', () => {
      const ctx = this.ctx;
      if (!ctx) return;
      if (document.hidden) {
        if (ctx.state === 'running') {
          this.visibilityMuted = true;
          ctx.suspend().catch(() => { /* ignore */ });
        }
      } else if (this.visibilityMuted && this.unlocked) {
        this.visibilityMuted = false;
        ctx.resume().catch(() => { /* ignore */ });
      }
    });
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const tryResume = () => {
      if (ctx.state === 'running') {
        this.unlocked = true;
        detach();
        return;
      }
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          this.unlocked = true;
          detach();
        }
      }).catch(() => { /* retry on the next gesture */ });
    };
    const detach = () => {
      window.removeEventListener('touchend', tryResume);
      window.removeEventListener('click', tryResume);
      window.removeEventListener('keydown', tryResume);
    };
    tryResume();
    if (!this.unlocked && !this.unlockAttached) {
      this.unlockAttached = true;
      window.addEventListener('touchend', tryResume, { passive: true });
      window.addEventListener('click', tryResume, { passive: true });
      window.addEventListener('keydown', tryResume, { passive: true });
    }
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus || !this.settings) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(clamp01(this.settings.master), t, 0.05);
    this.musicBus.gain.setTargetAtTime(clamp01(this.settings.music), t, 0.05);
    this.sfxBus.gain.setTargetAtTime(clamp01(this.settings.sfx), t, 0.05);
  }

  // ---------------------------------------------------------------- loading

  private preload(): void {
    if (this.preloadStarted || !this.ctx) return;
    this.preloadStarted = true;
    // SFX are small: warm the whole cache in the background so play() rarely needs a fallback.
    for (const key of SFX_KEYS) this.kickLoad(key);
  }

  private kickLoad(key: string): CacheEntry {
    let entry = this.cache.get(key);
    if (entry) return entry;
    entry = { buffer: null, promise: null, failed: false };
    this.cache.set(key, entry);
    const ctx = this.ctx;
    if (!ctx || !ALL_KEYS.has(key)) {
      entry.failed = true;
      return entry;
    }
    entry.promise = (async () => {
      try {
        const res = await fetch(audioUrl(key));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        entry!.buffer = buf;
        entry!.promise = null;
        this.onBufferReady(key, buf);
        return buf;
      } catch {
        entry!.failed = true;
        entry!.promise = null;
        return null;
      }
    })();
    return entry;
  }

  private onBufferReady(key: string, buf: AudioBuffer) {
    if (this.currentMusicKey === key) this.currentMusicVoice?.swapToBuffer(buf);
    for (const v of this.activeLoops) if (v.key === key) v.swapToBuffer(buf);
  }

  // ---------------------------------------------------------------- one-shots

  play(key: string, opts?: { volume?: number; rate?: number }): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const entry = this.kickLoad(key);
    const volume = clamp01(opts?.volume ?? 1);
    const baseRate = opts?.rate ?? 1;
    const rate = UI_JITTER_KEYS.has(key) ? baseRate * (1 + (Math.random() * 2 - 1) * 0.035) : baseRate;
    if (entry.buffer) {
      this.playBuffer(entry.buffer, volume, rate);
    } else {
      // Fallback now; if the real file loads later this specific one-shot has already
      // played (that is fine, one-shots are momentary), but future plays will use it.
      try { playFallback(ctx, this.sfxBus!, key, volume, rate); } catch (e) { console.warn('[audio] fallback failed', key, e); }
    }
  }

  private playBuffer(buf: AudioBuffer, volume: number, rate: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.max(0.25, Math.min(3, rate));
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.sfxBus!);
    src.start(0);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { /* noop */ } };
  }

  // ---------------------------------------------------------------- loops

  loop(key: string, opts?: { volume?: number; rate?: number }): LoopHandle {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return { setVolume() {}, setRate() {}, stop() {} };
    const entry = this.kickLoad(key);
    const voice = new Voice(ctx, this.sfxBus, key, false);
    const volume = clamp01(opts?.volume ?? 1);
    voice.setVolume(volume);
    if (opts?.rate) voice.setRate(opts.rate);
    if (entry.buffer) {
      voice.startWithBuffer(entry.buffer, 0.05);
    } else if (isKnownLoop(key)) {
      voice.startWithFallback(0.05);
    } else {
      // Unknown key and no file: return a harmless no-op handle rather than silence forever
      // pretending to be a real loop, but still safe to call.
      voice.startWithFallback(0.05);
    }
    this.activeLoops.add(voice);
    return {
      setVolume: (v) => voice.setVolume(v),
      setRate: (r) => voice.setRate(r),
      stop: () => { voice.stop(STOP_FADE); this.activeLoops.delete(voice); },
    };
  }

  // ---------------------------------------------------------------- music

  music(key: string | null): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicBus) { this.currentMusicKey = key; return; }
    if (key === this.currentMusicKey) return;
    const old = this.currentMusicVoice;
    this.currentMusicKey = key;
    if (old) old.stop(MUSIC_FADE);
    if (key === null) {
      this.currentMusicVoice = null;
      return;
    }
    const entry = this.kickLoad(key);
    const voice = new Voice(ctx, this.musicBus, key, true);
    voice.setVolume(1);
    if (entry.buffer) {
      voice.startWithBuffer(entry.buffer, MUSIC_FADE);
    } else if (isKnownMusic(key) || MUSIC_KEYS.includes(key as any)) {
      voice.startWithFallback(MUSIC_FADE);
    }
    this.currentMusicVoice = voice;
  }
}

const engine = new AudioEngine();

export const audio = {
  init(settings: Settings): void { engine.init(settings); },
  /** Call from the first user gesture (click, touchend, keydown). iOS needs it. */
  unlock(): void { engine.unlock(); },
  applySettings(settings: Settings): void { engine.applySettings(settings); },
  play(key: string, opts?: { volume?: number; rate?: number }): void { engine.play(key, opts); },
  loop(key: string, opts?: { volume?: number; rate?: number }): LoopHandle { return engine.loop(key, opts); },
  music(key: string | null): void { engine.music(key); },
};
