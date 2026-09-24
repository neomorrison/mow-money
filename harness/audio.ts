// Audio harness. Dev-only debug page for the audio builder: lists every SFX and music key
// with Play/Loop controls, plus a decode check that fetches and decodes every file directly
// (bypassing the engine cache) so missing or corrupt files are obvious at a glance.
import { audio, type LoopHandle } from '../src/audio';
import { SFX_KEYS, MUSIC_KEYS, audioUrl } from '../src/data/assets';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/save';

const LOOP_KEYS = ['reel_loop', 'push_loop', 'zt_loop', 'trimmer_loop', 'blower_loop', 'truck_loop', 'birds_ambience', 'rain_ambience'] as const;
const ONE_SHOT_KEYS = SFX_KEYS.filter((k) => !(LOOP_KEYS as readonly string[]).includes(k));

const settings: Settings = { ...DEFAULT_SETTINGS };
const activeLoops = new Map<string, LoopHandle>();

function log(msg: string) {
  const el = document.getElementById('log')!;
  const line = document.createElement('div');
  line.className = 'logline';
  line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
  el.prepend(line);
  while (el.childElementCount > 200) el.removeChild(el.lastChild!);
}

function row(key: string, kind: 'one-shot' | 'loop' | 'music'): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  const label = document.createElement('span');
  label.className = 'key';
  label.textContent = key;
  r.appendChild(label);

  if (kind === 'one-shot') {
    const btn = document.createElement('button');
    btn.textContent = 'Play';
    btn.onclick = () => { audio.play(key); log(`play ${key}`); };
    r.appendChild(btn);
  } else if (kind === 'loop') {
    const toggle = document.createElement('button');
    toggle.textContent = 'Loop';
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = '1';
    vol.disabled = true;
    const rate = document.createElement('input');
    rate.type = 'range'; rate.min = '0.5'; rate.max = '1.5'; rate.step = '0.05'; rate.value = '1';
    rate.disabled = true;
    toggle.onclick = () => {
      const active = activeLoops.get(key);
      if (active) {
        active.stop();
        activeLoops.delete(key);
        toggle.textContent = 'Loop';
        vol.disabled = true; rate.disabled = true;
        log(`stop loop ${key}`);
      } else {
        const handle = audio.loop(key, { volume: Number(vol.value), rate: Number(rate.value) });
        activeLoops.set(key, handle);
        toggle.textContent = 'Stop';
        vol.disabled = false; rate.disabled = false;
        log(`start loop ${key}`);
      }
    };
    vol.oninput = () => activeLoops.get(key)?.setVolume(Number(vol.value));
    rate.oninput = () => activeLoops.get(key)?.setRate(Number(rate.value));
    r.appendChild(toggle);
    r.appendChild(labeled('vol', vol));
    r.appendChild(labeled('rate', rate));
  } else {
    const btn = document.createElement('button');
    btn.textContent = 'Play music';
    btn.onclick = () => { audio.music(key); log(`music ${key}`); };
    r.appendChild(btn);
  }
  return r;
}

function labeled(text: string, el: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'inline';
  wrap.appendChild(document.createTextNode(text + ' '));
  wrap.appendChild(el);
  return wrap;
}

function section(title: string): HTMLElement {
  const s = document.createElement('div');
  s.className = 'section';
  const h = document.createElement('h2');
  h.textContent = title;
  s.appendChild(h);
  return s;
}

/** Fetches and decodes every known audio file directly, independent of the engine's cache,
 * so failures are visible even if the engine already fell back silently. Used by both the
 * on-page "Check decode" button and headless verification via tools/snap.mjs --eval. */
async function checkDecode(): Promise<{ key: string; ok: boolean; bytes: number; error: string }[]> {
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  const keys = [...SFX_KEYS, ...MUSIC_KEYS];
  const results: { key: string; ok: boolean; bytes: number; error: string }[] = [];
  for (const key of keys) {
    try {
      const res = await fetch(audioUrl(key));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      results.push({ key, ok: true, bytes: arr.byteLength, error: '' });
    } catch (e) {
      results.push({ key, ok: false, bytes: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  await ctx.close().catch(() => { /* ignore */ });
  return results;
}

function renderDecodeResults(results: { key: string; ok: boolean; bytes: number; error: string }[]) {
  const box = document.getElementById('decode-results')!;
  box.innerHTML = '';
  let failCount = 0;
  for (const r of results) {
    const line = document.createElement('div');
    line.className = r.ok ? 'decode-ok' : 'decode-fail';
    line.textContent = r.ok ? `OK    ${r.key}  (${r.bytes} bytes)` : `FAIL  ${r.key}  ${r.error}`;
    box.appendChild(line);
    if (!r.ok) failCount++;
  }
  const summary = document.createElement('div');
  summary.className = failCount ? 'decode-fail' : 'decode-ok';
  summary.style.fontWeight = '700';
  summary.textContent = failCount ? `${failCount} of ${results.length} files failed to decode (fallback synths cover these)` : `All ${results.length} files decoded fine`;
  box.prepend(summary);
  if (failCount) console.warn(`[audio harness] ${failCount} file(s) failed to decode`);
  else console.log('[audio harness] all files decoded ok');
}

function build() {
  const app = document.getElementById('app')!;

  const controls = section('Engine');
  const initBtn = document.createElement('button');
  initBtn.textContent = 'Init + Unlock';
  initBtn.onclick = () => { audio.init(settings); audio.unlock(); log('init + unlock called'); };
  controls.appendChild(initBtn);
  (['master', 'music', 'sfx'] as const).forEach((bus) => {
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.05';
    slider.value = String(settings[bus]);
    slider.oninput = () => { settings[bus] = Number(slider.value); audio.applySettings(settings); };
    controls.appendChild(labeled(bus, slider));
  });
  const decodeBtn = document.createElement('button');
  decodeBtn.textContent = 'Check decode (all files)';
  decodeBtn.onclick = async () => { decodeBtn.disabled = true; renderDecodeResults(await checkDecode()); decodeBtn.disabled = false; };
  controls.appendChild(decodeBtn);
  const decodeResults = document.createElement('div');
  decodeResults.id = 'decode-results';
  controls.appendChild(decodeResults);
  app.appendChild(controls);

  const musicSec = section('Music');
  MUSIC_KEYS.forEach((k) => musicSec.appendChild(row(k, 'music')));
  const stopMusic = document.createElement('button');
  stopMusic.textContent = 'Stop music';
  stopMusic.onclick = () => { audio.music(null); log('music null'); };
  musicSec.appendChild(stopMusic);
  app.appendChild(musicSec);

  const loopSec = section('Loops (engine sounds, ambience)');
  LOOP_KEYS.forEach((k) => loopSec.appendChild(row(k, 'loop')));
  app.appendChild(loopSec);

  const oneShotSec = section('One-shots');
  ONE_SHOT_KEYS.forEach((k) => oneShotSec.appendChild(row(k, 'one-shot')));
  app.appendChild(oneShotSec);

  const logSec = section('Log');
  const logBox = document.createElement('div');
  logBox.id = 'log';
  logSec.appendChild(logBox);
  app.appendChild(logSec);

  audio.init(settings);
}

build();

// Exposed for headless verification (node tools/snap.mjs --eval).
(window as any).__audioTest = {
  keys: [...SFX_KEYS, ...MUSIC_KEYS],
  checkDecode,
  playAll(): void { for (const k of SFX_KEYS) audio.play(k); },
  loopAll(): string[] { return LOOP_KEYS.map((k) => { audio.loop(k); return k; }); },
  playMusic(key: string): void { audio.music(key); },
};
