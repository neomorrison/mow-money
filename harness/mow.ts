// Standalone harness for the mowing job. Builds a MowJobSpec from query params:
//   ?mower=reel|push21|selfprop|walkbehind|zt48|standon|zt60|widearea|gangreel
//   &kind=residential|estate|commercial|park|golf &style=ranch &w=22 &d=30 (or &lawn=400 &aspect=1.3)
//   &grass=5.5 &target=3 &leaves=0 &weather=sunny &season=spring &tutorial=0 &seed=7 &minute=600
//   &trimmer=trimmer|shears|protrimmer|none &blower=blower|broom|backpack|none &bag=0 &stripes=0 &stripekit=0
//   &perks=quick_feet,edge_master &vehicle=veh_pickup &color=%23d9483b &sharp=1 &practice=0 &density=medium
// window.__mow = { autoMow(speedMult), finish(), state(), tool(n), camera(mode), teleport(x,z,h), clock(min), trimEdges() }
import { startMowJob, type MowDebugHandle } from '../src/mow/index';
import { EQUIPMENT_BY_ID } from '../src/data/equipment';
import { lotForLawn } from '../src/world/property';
import { computeQuality, TIME_SCALE } from '../src/sim/index';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/save';
import { audio } from '../src/audio/index';
import type { HouseStyle, HoodKind, MowJobResult, MowJobSpec, Season, WeatherKind } from '../src/core/types';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const str = (k: string, d: string) => q.get(k) ?? d;
const bool = (k: string, d = false) => (q.has(k) ? q.get(k) === '1' || q.get(k) === 'true' : d);

const errBox = document.getElementById('err')!;
function showErr(msg: string) { errBox.style.display = 'block'; errBox.textContent = msg; }
window.addEventListener('error', (e) => showErr(String(e.message)));

const kind = str('kind', 'residential') as HoodKind;
const defStyle: Record<HoodKind, HouseStyle> = { residential: 'ranch', estate: 'mansion', commercial: 'office', park: 'pavilion', golf: 'clubhouse' };
const style = str('style', defStyle[kind]) as HouseStyle;
const defLawn: Record<HoodKind, number> = { residential: 380, estate: 2200, commercial: 4000, park: 10000, golf: 20000 };
const lot = q.has('w') && q.has('d')
  ? { w: num('w', 22), d: num('d', 30), style, kind }
  : lotForLawn(num('lawn', defLawn[kind]), style, kind, num('aspect', kind === 'golf' ? 2.4 : 1.3));
const mowerId = str('mower', kind === 'golf' ? 'gangreel' : kind === 'park' ? 'widearea' : kind === 'estate' || kind === 'commercial' ? 'zt60' : 'push21');
const mower = EQUIPMENT_BY_ID[mowerId] ?? EQUIPMENT_BY_ID.push21;
const tId = str('trimmer', mower.tier >= 3 ? 'protrimmer' : 'trimmer');
const bId = str('blower', mower.tier >= 3 ? 'backpack' : 'blower');
const weather = str('weather', 'sunny') as WeatherKind;
const season = str('season', num('leaves', 0) > 0 ? 'fall' : 'spring') as Season;

const spec: MowJobSpec = {
  jobId: 'harness',
  kind: bool('practice') ? 'practice' : num('leaves', 0) > 0.5 ? 'leaves' : 'mow',
  clientId: 'c-harness',
  houseId: 'h-harness',
  address: str('address', '14 Maple Ln'),
  ownerName: str('owner', 'Doris Whitfield'),
  portrait: str('portrait', 'p_retiree_1'),
  lot,
  propertySeed: num('seed', 7),
  grassIn: num('grass', 4.8),
  targetIn: num('target', kind === 'golf' ? 1 : 3),
  expectation: num('expect', 72),
  wantsStripes: bool('stripes', kind !== 'residential'),
  mower,
  sharpness: num('sharp', 0.95),
  trimmer: tId === 'none' ? null : EQUIPMENT_BY_ID[tId] ?? null,
  blower: bId === 'none' ? null : EQUIPMENT_BY_ID[bId] ?? null,
  bagging: bool('bag', !!mower.bagging),
  striping: bool('stripekit'),
  weather,
  season,
  startMinute: num('minute', 600),
  timeScale: TIME_SCALE,
  wet: weather === 'rain' || weather === 'storm' || bool('wet'),
  leaves: num('leaves', 0),
  perks: str('perks', '').split(',').filter(Boolean),
  notes: q.has('notes') ? str('notes', '').split('|') : ['Please watch the flower bed by the porch.', 'The gnome is named Gerald. Be nice to Gerald.'],
  tutorial: bool('tutorial'),
  companyColor: str('color', '#d9483b'),
  vehicleModel: str('vehicle', mower.rideOn ? 'veh_pickup_trailer' : 'veh_bike'),
};

if (q.has('touch')) (window as any).__mmForceTouch = q.get('touch') === '1';
const settings: Settings = { ...DEFAULT_SETTINGS, grassDensity: (str('density', 'medium') as Settings['grassDensity']), shadows: !bool('noshadows') };
audio.init(settings);

const host = document.getElementById('host')!;
const resultEl = document.getElementById('result')!;
let handle: MowDebugHandle | null = null;

function showResult(r: MowJobResult, title: string) {
  let breakdown: unknown;
  try { breakdown = computeQuality(spec, r); } catch (e) { breakdown = `computeQuality unavailable: ${(e as Error).message}`; }
  (window as any).__mowResult = { result: r, quality: breakdown };
  resultEl.style.display = 'block';
  resultEl.innerHTML = `<h1>${title}</h1><div class="grid"><div><h3>MowJobResult</h3><pre>${JSON.stringify(r, null, 2)}</pre></div>
    <div><h3>Quality</h3><pre>${typeof breakdown === 'string' ? breakdown : JSON.stringify(breakdown, null, 2)}</pre></div></div>
    <p><button id="again">Mow again</button></p>`;
  document.getElementById('again')!.onclick = () => location.reload();
  handle?.dispose();
  handle = null;
}

try {
  handle = startMowJob(host, spec, {
    onFinish: (r) => showResult(r, 'Job finished'),
    onAbandon: (r) => showResult(r, 'Job abandoned'),
  }, settings) as MowDebugHandle;
} catch (e) {
  showErr('startMowJob failed: ' + (e as Error).message);
}
// headless runs on a machine with a controller plugged in: ?pad=0 ignores it
if (q.get('pad') === '0') handle?.job.setGamepad(false);

(window as any).__mow = {
  spec,
  get job() { return handle?.job; },
  autoMow(speedMult = 1) { handle?.job.autoMow(speedMult); return true; },
  finish() { handle?.job.finishNow(); return true; },
  state() { return handle ? handle.job.debugState() : { disposed: true, result: (window as any).__mowResult ?? null }; },
  tool(n: 1 | 2 | 3) { handle?.job.selectTool(n); return true; },
  camera(mode: 'chase' | 'top') { handle?.job.setCamera(mode); return true; },
  teleport(x: number, z: number, h = 0) { handle?.job.teleport(x, z, h); return true; },
  clock(minute: number) { handle?.job.setClock(minute); return true; },
  trimEdges() { handle?.job.trimAllEdges(); return true; },
  run(seconds: number) { handle?.job.fastForward(seconds); return handle?.job.debugState(); },
  step(n = 60, dt = 1 / 60) { for (let i = 0; i < n; i++) handle?.job.frameStep(dt); return true; },
};
