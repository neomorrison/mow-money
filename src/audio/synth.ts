// PROCEDURAL AUDIO FALLBACKS. OWNED BY THE AUDIO BUILDER.
// Pure Web Audio node graphs, no files. Used by src/audio/index.ts whenever a real
// file for a key is missing, still loading or failed to decode, so the game is never
// silent and never throws. Every builder here is deterministic-ish but uses a little
// randomness (jitter, sparse events) so repeats do not sound robotic.
//
// Two shapes:
//   playFallback(ctx, dest, key, volume, rate)  - fire-and-forget one-shot
//   startFallbackLoop(ctx, dest, key)           - continuous loop, returns a controller
//
// `dest` is always a GainNode the caller already owns (per-voice volume control), so this
// module never has to manage buses, ramps for stop-fades, or settings; it only builds sound.

type StopFn = () => void;
export interface FallbackLoopHandle { stop: StopFn; setRate(r: number): void }

// ---------------------------------------------------------------- shared helpers

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A few seconds of cached white noise, reused (looped) by every noise-based sound on a context. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

function noiseSource(ctx: BaseAudioContext): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  return src;
}

function rand(a: number, b: number): number { return a + Math.random() * (b - a); }

/** Exponential-ish decay envelope gain node, safe against zero targets. */
function envNode(ctx: BaseAudioContext, dest: AudioNode, t0: number, attack: number, peak: number, decay: number, sustain = 0): GainNode {
  const g = ctx.createGain();
  g.connect(dest);
  const p = ctx as unknown as AudioContext;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + Math.max(attack, 0.001));
  if (sustain > 0) {
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + attack + decay);
  } else {
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + Math.max(decay, 0.01));
  }
  void p;
  return g;
}

function tone(ctx: BaseAudioContext, dest: AudioNode, t0: number, freq: number, dur: number, opts: { type?: OscillatorType; peak?: number; attack?: number; glideTo?: number } = {}) {
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
  const g = envNode(ctx, dest, t0, opts.attack ?? 0.006, opts.peak ?? 0.6, dur);
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function thump(ctx: BaseAudioContext, dest: AudioNode, t0: number, freq = 100, dur = 0.12, peak = 0.8) {
  tone(ctx, dest, t0, freq, dur, { type: 'sine', peak, attack: 0.004, glideTo: freq * 0.6 });
  // a touch of noise for body
  const src = noiseSource(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = freq * 3;
  const g = envNode(ctx, bp, t0, 0.002, peak * 0.35, dur * 0.6);
  src.connect(g);
  bp.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function noiseBurst(ctx: BaseAudioContext, dest: AudioNode, t0: number, dur: number, opts: { type?: BiquadFilterType; freq?: number; q?: number; peak?: number; sweepTo?: number } = {}) {
  const src = noiseSource(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = opts.type ?? 'bandpass';
  filt.frequency.setValueAtTime(opts.freq ?? 2000, t0);
  if (opts.sweepTo) filt.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
  filt.Q.value = opts.q ?? 1;
  const g = envNode(ctx, filt, t0, 0.004, opts.peak ?? 0.6, dur);
  src.connect(g);
  filt.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function chime(ctx: BaseAudioContext, dest: AudioNode, t0: number, freq: number, dur = 0.7, peak = 0.5) {
  // bell-ish: fundamental plus a quiet high partial
  tone(ctx, dest, t0, freq, dur, { type: 'sine', peak, attack: 0.01 });
  tone(ctx, dest, t0, freq * 2.01, dur * 0.6, { type: 'sine', peak: peak * 0.25, attack: 0.01 });
}

function arpeggio(ctx: BaseAudioContext, dest: AudioNode, t0: number, freqs: number[], step: number, noteDur: number, peak = 0.5, type: OscillatorType = 'triangle') {
  freqs.forEach((f, i) => tone(ctx, dest, t0 + i * step, f, noteDur, { type, peak, attack: 0.004 }));
}

// ---------------------------------------------------------------- one-shots

const ONE_SHOT_BUILDERS: Record<string, (ctx: BaseAudioContext, dest: AudioNode, t0: number) => void> = {
  knock(ctx, dest, t0) {
    thump(ctx, dest, t0, rand(110, 130), 0.09, 0.9);
    thump(ctx, dest, t0 + 0.16, rand(105, 125), 0.1, 0.85);
  },
  doorbell(ctx, dest, t0) {
    chime(ctx, dest, t0, 784, 0.9, 0.45);
    chime(ctx, dest, t0 + 0.22, 659, 1.1, 0.4);
  },
  door_open(ctx, dest, t0) {
    thump(ctx, dest, t0, 70, 0.1, 0.4);
    noiseBurst(ctx, dest, t0 + 0.03, 0.4, { type: 'lowpass', freq: 1200, sweepTo: 400, peak: 0.3 });
  },
  cash(ctx, dest, t0) {
    tone(ctx, dest, t0, 1300, 0.14, { type: 'triangle', peak: 0.5 });
    tone(ctx, dest, t0 + 0.07, 1900, 0.18, { type: 'triangle', peak: 0.45 });
  },
  tip(ctx, dest, t0) {
    tone(ctx, dest, t0, 1500, 0.16, { type: 'triangle', peak: 0.35 });
  },
  deal(ctx, dest, t0) {
    arpeggio(ctx, dest, t0, [523, 659, 784, 1047], 0.07, 0.16, 0.4);
  },
  reject(ctx, dest, t0) {
    tone(ctx, dest, t0, 300, 0.22, { type: 'sawtooth', peak: 0.3, glideTo: 190 });
  },
  cut_crunch(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, rand(0.08, 0.12), { type: 'bandpass', freq: rand(900, 1400), q: 0.7, peak: 0.5 });
  },
  bump(ctx, dest, t0) {
    thump(ctx, dest, t0, 85, 0.09, 0.6);
  },
  break(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, 0.1, { type: 'highpass', freq: 1500, peak: 0.5 });
    tone(ctx, dest, t0, 260, 0.14, { type: 'square', peak: 0.35, glideTo: 120 });
  },
  bag_full(ctx, dest, t0) {
    tone(ctx, dest, t0, 420, 0.25, { type: 'sine', peak: 0.35, glideTo: 300 });
    thump(ctx, dest, t0 + 0.2, 90, 0.1, 0.3);
  },
  bag_empty(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, 0.3, { type: 'bandpass', freq: 2200, sweepTo: 500, q: 0.6, peak: 0.35 });
  },
  day_end(ctx, dest, t0) {
    chime(ctx, dest, t0, 659, 0.7, 0.35);
    chime(ctx, dest, t0 + 0.28, 494, 1.0, 0.32);
  },
  level_up(ctx, dest, t0) {
    arpeggio(ctx, dest, t0, [523, 659, 784, 1047, 1319], 0.075, 0.2, 0.45);
  },
  achievement(ctx, dest, t0) {
    [523, 659, 784].forEach((f) => tone(ctx, dest, t0, f, 0.5, { type: 'triangle', peak: 0.28 }));
    arpeggio(ctx, dest, t0 + 0.25, [1047, 1319, 1568], 0.06, 0.35, 0.32);
  },
  dog_bark(ctx, dest, t0) {
    tone(ctx, dest, t0, 340, 0.11, { type: 'sawtooth', peak: 0.45, glideTo: 220 });
    tone(ctx, dest, t0 + 0.16, 320, 0.1, { type: 'sawtooth', peak: 0.35, glideTo: 200 });
  },
  sprinkler_hit(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, 0.18, { type: 'bandpass', freq: 3200, sweepTo: 1800, q: 0.8, peak: 0.35 });
    for (let i = 0; i < 3; i++) tone(ctx, dest, t0 + 0.05 + i * 0.05, rand(2400, 3600), 0.05, { type: 'sine', peak: 0.12 });
  },
  gnome_break(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, 0.18, { type: 'highpass', freq: 2000, peak: 0.5 });
    for (let i = 0; i < 4; i++) tone(ctx, dest, t0 + rand(0.02, 0.15), rand(1800, 3000), 0.08, { type: 'triangle', peak: 0.15 });
  },
  click(ctx, dest, t0) {
    noiseBurst(ctx, dest, t0, 0.02, { type: 'highpass', freq: 3500, peak: 0.25 });
  },
  hover(ctx, dest, t0) {
    tone(ctx, dest, t0, 1800, 0.03, { type: 'sine', peak: 0.08 });
  },
};

export function isKnownOneShot(key: string): boolean { return key in ONE_SHOT_BUILDERS; }

export function playFallback(ctx: BaseAudioContext, dest: AudioNode, key: string, volume = 1, rate = 1): void {
  const build = ONE_SHOT_BUILDERS[key];
  if (!build) return;
  const g = (ctx as AudioContext).createGain();
  g.gain.value = Math.max(0, volume);
  g.connect(dest);
  // `rate` on a fallback just shifts perceived pitch/speed by nudging playback via detune-ish
  // scaling: we approximate it by temporarily biasing Math.random ranges is overkill, so we
  // simply scale playback speed by wrapping the builder in an OfflineAudioContext-free trick:
  // fallbacks are short enough that a flat pitch bump reads fine for one-shots.
  const t0 = (ctx as AudioContext).currentTime + 0.001;
  if (rate !== 1 && (ctx as AudioContext).sampleRate) {
    // Cheap approximation: nothing to resample live without a buffer, so rate mostly
    // matters for buffer-backed sounds. Fallbacks stay at natural pitch.
  }
  build(ctx, g, t0);
}

// ---------------------------------------------------------------- continuous loops

function makeHumLoop(ctx: BaseAudioContext, dest: AudioNode, opts: {
  fundamental: number; noiseCut: number; noiseType: BiquadFilterType; noisePeak: number; tonePeak: number; tremoloHz?: number; tremoloDepth?: number; extraSubHz?: number;
}): FallbackLoopHandle {
  const ac = ctx as AudioContext;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = opts.fundamental;
  const oscGain = ac.createGain();
  oscGain.gain.value = opts.tonePeak;
  osc.connect(oscGain);

  let sub: OscillatorNode | null = null;
  let subGain: GainNode | null = null;
  if (opts.extraSubHz) {
    sub = ac.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = opts.extraSubHz;
    subGain = ac.createGain();
    subGain.gain.value = opts.tonePeak * 0.6;
    sub.connect(subGain);
  }

  const noise = noiseSource(ac);
  const filt = ac.createBiquadFilter();
  filt.type = opts.noiseType;
  filt.frequency.value = opts.noiseCut;
  const noiseGain = ac.createGain();
  noiseGain.gain.value = opts.noisePeak;
  noise.connect(filt);
  filt.connect(noiseGain);

  const mix = ac.createGain();
  mix.gain.value = 1;
  oscGain.connect(mix);
  subGain?.connect(mix);
  noiseGain.connect(mix);

  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (opts.tremoloHz) {
    lfo = ac.createOscillator();
    lfo.frequency.value = opts.tremoloHz;
    lfoGain = ac.createGain();
    lfoGain.gain.value = opts.tremoloDepth ?? 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(mix.gain);
  }

  mix.connect(dest);
  const t0 = ac.currentTime;
  osc.start(t0);
  sub?.start(t0);
  noise.start(t0);
  lfo?.start(t0);

  return {
    setRate(r: number) {
      const rr = Math.max(0.4, Math.min(2, r));
      osc.frequency.setTargetAtTime(opts.fundamental * rr, ac.currentTime, 0.08);
      if (sub) sub.frequency.setTargetAtTime((opts.extraSubHz ?? 0) * rr, ac.currentTime, 0.08);
    },
    stop() {
      try { osc.stop(); sub?.stop(); noise.stop(); lfo?.stop(); } catch { /* already stopped */ }
      [osc, sub, noise, lfo].forEach((n) => { try { n?.disconnect(); } catch { /* noop */ } });
      [oscGain, subGain, noiseGain, mix, filt, lfoGain].forEach((n) => { try { n?.disconnect(); } catch { /* noop */ } });
    },
  };
}

function makeClickLoop(ctx: BaseAudioContext, dest: AudioNode, bpm: number, clickFreq: number, clickDur: number, jitter: number): FallbackLoopHandle {
  const ac = ctx as AudioContext;
  let stopped = false;
  let rateMult = 1;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const interval = () => (60 / (bpm * rateMult)) * rand(1 - jitter, 1 + jitter);

  function scheduleNext() {
    if (stopped) return;
    const t0 = ac.currentTime + 0.01;
    noiseBurst(ac, dest, t0, clickDur, { type: 'bandpass', freq: clickFreq, q: 2.5, peak: 0.5 });
    timer = setTimeout(scheduleNext, interval() * 1000);
  }
  scheduleNext();

  return {
    setRate(r: number) { rateMult = Math.max(0.4, Math.min(2, r)); },
    stop() { stopped = true; if (timer) clearTimeout(timer); },
  };
}

function makeSparseLoop(ctx: BaseAudioContext, dest: AudioNode, minGap: number, maxGap: number, fire: (ac: AudioContext, dest: AudioNode, t0: number) => void): FallbackLoopHandle {
  const ac = ctx as AudioContext;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  function scheduleNext() {
    if (stopped) return;
    fire(ac, dest, ac.currentTime + 0.01);
    timer = setTimeout(scheduleNext, rand(minGap, maxGap) * 1000);
  }
  timer = setTimeout(scheduleNext, rand(0, maxGap * 0.5) * 1000);
  return { setRate() {}, stop() { stopped = true; if (timer) clearTimeout(timer); } };
}

function makeSteadyNoiseLoop(ctx: BaseAudioContext, dest: AudioNode, freq: number, q: number, type: BiquadFilterType, peak: number, wobbleHz: number): FallbackLoopHandle {
  const ac = ctx as AudioContext;
  const src = noiseSource(ac);
  const filt = ac.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = ac.createGain();
  g.gain.value = peak;
  const lfo = ac.createOscillator();
  lfo.frequency.value = wobbleHz;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = freq * 0.15;
  lfo.connect(lfoGain);
  lfoGain.connect(filt.frequency);
  src.connect(filt);
  filt.connect(g);
  g.connect(dest);
  const t0 = ac.currentTime;
  src.start(t0);
  lfo.start(t0);
  return {
    setRate() { /* ambience is not tempo-scaled */ },
    stop() {
      try { src.stop(); lfo.stop(); } catch { /* noop */ }
      [src, filt, g, lfo, lfoGain].forEach((n) => { try { n.disconnect(); } catch { /* noop */ } });
    },
  };
}

const LOOP_BUILDERS: Record<string, (ctx: BaseAudioContext, dest: AudioNode) => FallbackLoopHandle> = {
  reel_loop: (ctx, dest) => makeClickLoop(ctx, dest, 220, 2400, 0.02, 0.12),
  push_loop: (ctx, dest) => makeHumLoop(ctx, dest, {
    fundamental: 78, noiseCut: 750, noiseType: 'lowpass', noisePeak: 0.22, tonePeak: 0.28, tremoloHz: 5.5, tremoloDepth: 0.12,
  }),
  zt_loop: (ctx, dest) => makeHumLoop(ctx, dest, {
    fundamental: 46, noiseCut: 480, noiseType: 'lowpass', noisePeak: 0.22, tonePeak: 0.32, extraSubHz: 23, tremoloHz: 8, tremoloDepth: 0.08,
  }),
  trimmer_loop: (ctx, dest) => makeHumLoop(ctx, dest, {
    fundamental: 210, noiseCut: 2600, noiseType: 'highpass', noisePeak: 0.18, tonePeak: 0.24, tremoloHz: 14, tremoloDepth: 0.06,
  }),
  blower_loop: (ctx, dest) => makeSteadyNoiseLoop(ctx, dest, 1900, 0.9, 'bandpass', 0.32, 0.6),
  truck_loop: (ctx, dest) => makeHumLoop(ctx, dest, {
    fundamental: 52, noiseCut: 400, noiseType: 'lowpass', noisePeak: 0.16, tonePeak: 0.3, extraSubHz: 26, tremoloHz: 12, tremoloDepth: 0.05,
  }),
  birds_ambience: (ctx, dest) => makeSparseLoop(ctx, dest, 1.2, 4.5, (ac, d, t0) => {
    const start = rand(2200, 4200);
    tone(ac, d, t0, start, rand(0.08, 0.16), { type: 'sine', peak: rand(0.05, 0.1), glideTo: start * rand(0.85, 1.2), attack: 0.01 });
  }),
  rain_ambience: (ctx, dest) => makeSteadyNoiseLoop(ctx, dest, 1600, 0.7, 'lowpass', 0.28, 0.15),
};

export function isKnownLoop(key: string): boolean { return key in LOOP_BUILDERS; }

export function startFallbackLoop(ctx: BaseAudioContext, dest: AudioNode, key: string): FallbackLoopHandle {
  const build = LOOP_BUILDERS[key];
  if (!build) return { setRate() {}, stop() {} };
  return build(ctx, dest);
}

// ---------------------------------------------------------------- music (very light pad fallback)

const MUSIC_CHORDS: Record<string, number[][]> = {
  music_title: [[261, 329, 392], [293, 349, 440]],
  music_hub: [[220, 277, 329], [196, 246, 293]],
  music_mow: [[246, 293, 369], [220, 277, 329]],
};

export function isKnownMusic(key: string): boolean { return key in MUSIC_CHORDS; }

export function startFallbackMusic(ctx: BaseAudioContext, dest: AudioNode, key: string): FallbackLoopHandle {
  const chords = MUSIC_CHORDS[key] ?? MUSIC_CHORDS.music_hub;
  const ac = ctx as AudioContext;
  let stopped = false;
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  let chordIdx = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function playChord() {
    if (stopped) return;
    const chord = chords[chordIdx % chords.length];
    chordIdx++;
    const t0 = ac.currentTime + 0.05;
    const dur = 3.6;
    chord.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = i === 0 ? -4 : 4;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
      oscs.push(osc);
      gains.push(g);
    });
    timer = setTimeout(playChord, dur * 1000 * 0.92);
  }
  playChord();

  return {
    setRate() {},
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
    },
  };
}
