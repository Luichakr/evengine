// Bootstrap + screen flow + game loop for Ghost Engine (UA).
import { ENGINES, ENGINE_ORDER } from './engines.js';
import { t, pick, getLang, setLang, defaultLang, applyStatic, onLangChange } from './i18n.js';
import { brandMark } from './logo.js';
import { buildIntro } from './intro.js';
import { needsSafety, acceptSafety } from './safety.js';
import { Cluster } from './gauges.js';
import { Drivetrain } from './drivetrain.js';
import { GpsSpeed, DemoSpeed } from './speed.js';
import { fx } from './fx.js';
import { SynthAudio } from './synth-audio.js';
import { unlock, setRoute, beep, resumeIfNeeded } from './audio-out.js';

const $ = id => document.getElementById(id);
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

const state = {
  engineId: store.get('ge.engine') && ENGINES[store.get('ge.engine')] ? store.get('ge.engine') : 'v12',
  demo: store.get('ge.demo') !== 'off',
  stats: store.get('ge.stats') !== 'off',
  running: false, throttle: 0, wakeLock: null, cranking: false
};
const engine = () => ENGINES[state.engineId];

const audio = new SynthAudio();
let cluster, drivetrain, speed, startedAt = 0;

/* ---------- screens ---------- */
const SCREENS = ['safety', 'intro', 'picker', 'cluster'];
function showScreen(name) {
  SCREENS.forEach(s => { const el = $('screen-' + s); if (el) el.hidden = s !== name; });
}

/* ---------- i18n + brand ---------- */
setLang(defaultLang());
onLangChange(() => { if (cluster && cluster.engine) cluster.build(); if (pickerBg) buildPickerBg(); buildEngineCards(); markSelected(); });
$('langSeg').addEventListener('click', e => { const b = e.target.closest('button[data-lang]'); if (b) setLang(b.dataset.lang); });

/* ---------- engine cards ---------- */
function cardHtml(id) {
  const e = ENGINES[id], s = e.synth;
  const spec = `${s.cylinders} ${getLang() === 'uk' ? 'ЦИЛ' : 'CYL'} · ${e.redline.toLocaleString(getLang() === 'uk' ? 'uk-UA' : 'en-US')} ${t('rpmUnit')}`;
  return `<button type="button" class="engine-card" role="radio" data-id="${id}" aria-checked="${id === state.engineId}">
    <span class="spec">${spec}</span><span class="name">${pick(e.name)}</span>
    <span class="desc">${pick(e.description)}</span><span class="ex">${(getLang() === 'uk' ? 'Напр.: ' : 'E.g. ') + e.examples}</span></button>`;
}
function buildEngineCards() {
  const html = ENGINE_ORDER.map(cardHtml).join('');
  $('engineGrid').innerHTML = html;
  $('engineGridSheet').innerHTML = html;
}

// Faint "cabin" cluster behind the picker cards (like the original).
let pickerBg = null;
function buildPickerBg() {
  if (!pickerBg) pickerBg = new Cluster($('pickerBg'));
  pickerBg.setEngine(engine());
  pickerBg.render(0, 0, 'N');
}
function markSelected() {
  document.querySelectorAll('.engine-card').forEach(c => c.setAttribute('aria-checked', c.dataset.id === state.engineId));
}
function selectEngine(id) {
  if (!ENGINES[id]) return;
  state.engineId = id; store.set('ge.engine', id); markSelected();
  if (pickerBg) { pickerBg.setEngine(engine()); pickerBg.render(0, 0, 'N'); }
  if (cluster) cluster.setEngine(engine());
  if (state.running) { audio.setProfile(synthProfile()); fx.event('switch'); if (drivetrain) drivetrain.setEngine(engine()); }
}
document.addEventListener('click', e => { const c = e.target.closest('.engine-card'); if (c) { selectEngine(c.dataset.id); closeEngineSheet(); } });
const synthProfileOf = e => Object.assign({}, e.synth, { idleRpm: e.idleRpm });
const synthProfile = () => synthProfileOf(engine());

/* ---------- safety ---------- */
$('safetyOk').onclick = () => { acceptSafety(); goIntro(); };

/* ---------- intro ---------- */
let introRing = null;
function goIntro() {
  showScreen('intro');
  if (!introRing) introRing = buildIntro($('introMark'));
  $('screen-intro').classList.remove('ignited');
  introRing.fill(0);
  // Silent gauge self-test on appearance: the ring sweeps up to full and back, no sound.
  const t0 = performance.now();
  const sweep = () => {
    const scr = $('screen-intro');
    if (scr.hidden || scr.classList.contains('ignited')) return;   // stop if the user ignited / left
    const t = (performance.now() - t0) / 1000;
    if (t < 1.7) { introRing.fill(Math.sin(Math.PI * (t / 1.7))); requestAnimationFrame(sweep); }
    else introRing.fill(0);
  };
  requestAnimationFrame(sweep);
}
async function ignite() {
  const scr = $('screen-intro'); if (scr.classList.contains('ignited')) return;
  scr.classList.add('ignited');
  unlock();                                   // unlock Web Audio synchronously inside the tap
  const E = ENGINES.v8it;                      // the ignition rev always plays the Italian V8
  const idle = E.idleRpm, redline = E.redline, limiter = (E.synth && E.synth.limiterRpm) || redline;
  await audio.init();
  audio.setProfile(synthProfileOf(E));
  audio.on(true); audio.crank(true); audio.ignition(true);
  // Scripted ignition: starter cranks → catches and flares → a beat → floors it to the limiter → lifts
  // off (crackle) and falls back → engine shuts off as the picker appears. The ring lights with the revs.
  const t0 = performance.now();
  let crankCleared = false;
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    let rpm, load = 0, overrun = false;
    if (t < 0.65) { rpm = 240 + 40 * Math.sin(t * 26); }                                   // starter cranking
    else if (t < 1.05) { const p = (t - 0.65) / 0.4; rpm = idle + (idle * 1.7 - idle) * p; load = 0.5; }  // catches, small flare
    else if (t < 1.5) { rpm = idle * (1 + 0.03 * Math.sin(t * 20)); }                       // settles to idle for a beat
    else if (t < 2.35) { const p = (t - 1.5) / 0.85; rpm = idle + (limiter - idle) * p; load = 1; }       // floors it up until it just touches the limiter
    else if (t < 3.2) { const p = (t - 2.35) / 0.85; rpm = limiter - (limiter - idle) * p; load = 0; overrun = true; }  // touches and comes straight back — crackle/pops on the way down
    else { rpm = idle * (1 + 0.025 * Math.sin(t * 16)); }                                   // smooth idle for a beat so the pops tail and the even idle are heard
    if (t >= 0.65 && !crankCleared) { crankCleared = true; audio.crank(false); }
    audio.update({ rpm: Math.round(rpm), load, overrun });
    if (introRing) introRing.fill(rpm / redline);
    if (t < 4.2) requestAnimationFrame(tick);
    else { audio.ignition(false); audio.on(false); }                                        // shut off with the clunk
  };
  requestAnimationFrame(tick);
  setTimeout(goPicker, 3800);                 // touch limiter → fall (pops) → a short beat of smooth idle, then the picker
}
$('igniteBtn').onclick = ignite;
$('screen-intro').addEventListener('click', e => { if (e.target.id !== 'igniteBtn') ignite(); });

/* ---------- picker ---------- */
function goPicker() { showScreen('picker'); markSelected(); buildPickerBg(); }
$('startBtn').onclick = () => startDrive();

/* ---------- cluster + drive ---------- */
function ensureSim() {
  if (!cluster) cluster = new Cluster($('cluster'), openEngineSheet);
  cluster.setEngine(engine());
  drivetrain = new Drivetrain(engine());
  speed = state.demo ? new DemoSpeed() : new GpsSpeed(setGpsStatus);
}
async function startDrive() {
  showScreen('cluster');
  ensureSim();
  fx.event('start');
  await audio.init();
  audio.setProfile(synthProfile());
  audio.on(true); audio.ignition(true);
  drivetrain.start(); speed.start();
  state.running = true; startedAt = Date.now();
  requestWakeLock();
  showVolumeToast();
  updateRevBtn(0);
  if (!loopOn) { loopOn = true; last = performance.now(); requestAnimationFrame(loop); }
  track('start');
}
function stopDrive() {
  if (!drivetrain) return;
  audio.ignition(false); drivetrain.shutdown();
  const waitStop = () => {
    if (drivetrain.isOff()) { audio.on(false); speed.stop(); state.running = false; releaseWakeLock(); track('stop', { secondsRun: Math.round((Date.now() - startedAt) / 1000) }); goPicker(); }
    else setTimeout(waitStop, 100);
  };
  waitStop();
}
$('stopBtn').onclick = stopDrive;

// HOLD TO REV
const rev = $('revBtn');
const revDown = e => { e.preventDefault(); state.throttle = 1; };
const revUp = () => { state.throttle = 0; };
rev.addEventListener('pointerdown', revDown); rev.addEventListener('pointerup', revUp);
rev.addEventListener('pointerleave', revUp); rev.addEventListener('pointercancel', revUp);
function updateRevBtn(kmh) { rev.classList.toggle('hidden', kmh > 2); }

// volume toast auto-hide
function showVolumeToast() {
  const toast = $('volumeToast'); toast.hidden = false; toast.classList.remove('fade');
  setTimeout(() => { toast.classList.add('fade'); if (cluster) cluster.setNoteVisible(true); setTimeout(() => toast.hidden = true, 250); }, 5000);
}

/* ---------- game loop ---------- */
let loopOn = false, last = 0, slowFrames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (dt > 0.033) fx.markSlow(true);
  const s = speed.sample();
  const d = drivetrain.update(s.speedMs, s.accelMs2, dt, state.throttle);
  cluster.render(d.rpm, Math.round(d.kmh), d.neutral ? 'N' : String(d.gear));
  fx.frame(d.rpm / engine().redline, d.kmh, d.event, state.running);
  if (!!d.cranking !== state.cranking) { state.cranking = !!d.cranking; audio.crank(state.cranking); }
  audio.update({ rpm: d.rpm, load: d.load, overrun: d.overrun, event: d.event });
  updateRevBtn(d.kmh);
  if (state.running || d.rpm > 0) requestAnimationFrame(loop); else loopOn = false;
}

/* ---------- wake lock ---------- */
async function requestWakeLock() { try { state.wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) {} }
function releaseWakeLock() { try { state.wakeLock?.release(); } catch (e) {} state.wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (state.running) requestWakeLock(); resumeIfNeeded(); } });

/* ---------- menu ---------- */
function openDrawer() { $('drawerBackdrop').hidden = false; $('drawer').hidden = false; }
function closeDrawer() { $('drawerBackdrop').hidden = true; $('drawer').hidden = true; }
$('menuBtn').onclick = openDrawer; $('drawerClose').onclick = closeDrawer; $('drawerBackdrop').onclick = closeDrawer;
function toggleSwitch(btn, key, onChange) {
  const on = !btn.classList.contains('on'); btn.classList.toggle('on', on); btn.setAttribute('aria-checked', String(on));
  store.set(key, on ? 'on' : 'off'); onChange(on);
}
$('demoSwitch').classList.toggle('on', state.demo); $('demoSwitch').setAttribute('aria-checked', String(state.demo));
$('statsSwitch').classList.toggle('on', state.stats); $('statsSwitch').setAttribute('aria-checked', String(state.stats));
$('demoSwitch').onclick = () => toggleSwitch($('demoSwitch'), 'ge.demo', on => {
  state.demo = on; setGpsStatus(on ? 'off' : (speed && speed.status) || 'off');
  if (state.running) { speed.stop && speed.stop(); speed = on ? new DemoSpeed() : new GpsSpeed(setGpsStatus); speed.start(); }
});
$('statsSwitch').onclick = () => toggleSwitch($('statsSwitch'), 'ge.stats', on => { state.stats = on; });
function setGpsStatus(s) {
  const map = { on: 'On', off: state.demo ? 'Off (demo)' : 'Off', pending: 'Pending…', blocked: 'Blocked' };
  $('gpsStatus').textContent = map[s] || 'Off (demo)';
}
setGpsStatus('off');
$('beep1').onclick = () => beep('direct'); $('beep2').onclick = () => beep('media'); $('beep3').onclick = () => beep('file');
$('routeSeg').addEventListener('click', e => { const b = e.target.closest('button[data-route]'); if (!b) return; setRoute(b.dataset.route); [...$('routeSeg').children].forEach(x => x.classList.toggle('active', x === b)); });

// Remind button only on a phone (not the Tesla browser)
const isTesla = /QtCarBrowser/.test(navigator.userAgent);
const isPhone = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints >= 1 && !isTesla;
if (isPhone) { $('remindBtn').hidden = false; $('remindBtn').onclick = saveReminder; $('remindBanner').hidden = false; $('remindBanner').onclick = saveReminder; }
function saveReminder() {
  const dt = new Date(Date.now() + 36e5);
  const stamp = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'DTSTART:' + stamp(dt), 'DTEND:' + stamp(new Date(dt.getTime() + 6e5)),
    'SUMMARY:Ghost Engine', 'DESCRIPTION:' + location.href, 'URL:' + location.href, 'BEGIN:VALARM', 'TRIGGER:-PT1M', 'ACTION:DISPLAY', 'DESCRIPTION:Ghost Engine', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'ghost-engine.ics'; a.click();
}

/* ---------- engine sheet (change engine from cluster) ---------- */
function openEngineSheet() { $('engSheetBackdrop').hidden = false; $('engineSheet').hidden = false; markSelected(); }
function closeEngineSheet() { $('engSheetBackdrop').hidden = true; $('engineSheet').hidden = true; }
$('engSheetClose').onclick = closeEngineSheet; $('engSheetBackdrop').onclick = closeEngineSheet;

/* ---------- stats (best-effort, no cookies, no ids) ---------- */
const STATS_ENDPOINT = null;   // set to your Worker '/e' URL to enable
function track(e, extra) {
  if (!state.stats || !STATS_ENDPOINT) return;
  try { navigator.sendBeacon?.(STATS_ENDPOINT, JSON.stringify(Object.assign({ e, engine: state.engineId, lang: getLang(), ts: Date.now() }, extra || {}))); } catch (_) {}
}

/* ---------- resize + SW ---------- */
window.addEventListener('resize', () => { if (cluster) cluster.refit(); if (pickerBg) { pickerBg.refit(); pickerBg.render(0, 0, 'N'); } });
window.addEventListener('orientationchange', () => setTimeout(() => { cluster && cluster.refit(); if (pickerBg) { pickerBg.refit(); pickerBg.render(0, 0, 'N'); } }, 300));
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => resumeIfNeeded(), { passive: true }));
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- boot ---------- */
buildEngineCards();
if (needsSafety()) showScreen('safety'); else goIntro();

// expose a little for debugging/verification
window.GE = { state, engine, get cluster() { return cluster; } };
