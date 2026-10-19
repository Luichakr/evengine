// One shared AudioContext and the output routing that makes sound reach the car's speakers.
// 'direct' → ctx.destination. 'media' → a MediaStreamDestination played through an <audio> element
// (some car browsers only route media-element playback to the car audio).

let ctx = null, bus = null, analyser = null, mediaDest = null, mediaEl = null, route = 'direct';
let volume = 0.8;
const buf = new Float32Array(2048);

// Master volume, 0..1 (slightly curved so the lower half of the slider is useful)
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (bus) bus.gain.setTargetAtTime(Math.pow(volume, 1.6) * 1.25, ctx.currentTime, 0.03);
}
export function getVolume() { return volume; }

export function context() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
  bus = ctx.createGain();
  bus.gain.value = Math.pow(volume, 1.6) * 1.25;
  analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  bus.connect(analyser);
  connectRoute();
  return ctx;
}
export function output() { context(); return bus; }

function connectRoute() {
  try { analyser.disconnect(); } catch (e) {}
  if (route === 'media' && ctx.createMediaStreamDestination) {
    if (!mediaDest) { mediaDest = ctx.createMediaStreamDestination(); mediaEl = new Audio(); mediaEl.autoplay = true; mediaEl.srcObject = mediaDest.stream; }
    analyser.connect(mediaDest);
  } else analyser.connect(ctx.destination);
}
export function setRoute(r) { route = r; if (!ctx) return; connectRoute(); if (route === 'media' && mediaEl) mediaEl.play().catch(() => {}); else if (mediaEl) mediaEl.pause(); }
export function getRoute() { return route; }

// Must run synchronously inside a tap. Older Chromium only unlocks audio during the gesture itself.
export function unlock() {
  const c = context();
  if (c.state !== 'running' && c.resume) c.resume();
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
  if (route === 'media' && mediaEl) mediaEl.play().catch(() => {});
}
export function resumeIfNeeded() { if (ctx && ctx.state !== 'running') return ctx.resume().catch(() => {}); return Promise.resolve(); }

export function level() {
  if (!analyser) return -100;
  analyser.getFloatTimeDomainData(buf);
  let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-5);
}
export function sampleRate() { return ctx ? ctx.sampleRate : 0; }
export function state() { return ctx ? ctx.state : 'none'; }

// Sound check beeps: 1 direct, 2 media, 3 a short WAV through a plain <audio> (file-as-media route).
export function beep(kind) {
  if (kind === 'file') {
    const sr = 22050, n = sr * 0.5, data = new DataView(new ArrayBuffer(44 + n * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true);
    data.setUint16(20, 1, true); data.setUint16(22, 1, true); data.setUint32(24, sr, true); data.setUint32(28, sr * 2, true);
    data.setUint16(32, 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) data.setInt16(44 + i * 2, Math.sin(i / sr * TwoPi() * 440) * 0.4 * 32767 * Math.min(1, (n - i) / 2000), true);
    const a = new Audio(URL.createObjectURL(new Blob([data.buffer], { type: 'audio/wav' })));
    return a.play().catch(() => {});
  }
  const prev = route; setRoute(kind === 'media' ? 'media' : 'direct'); unlock();
  const c = context(), o = c.createOscillator(), g = c.createGain();
  o.frequency.value = kind === 'media' ? 660 : 440;
  g.gain.setValueAtTime(0.4, c.currentTime); g.gain.setTargetAtTime(0, c.currentTime + 0.4, 0.05);
  o.connect(g); g.connect(bus); o.start(); o.stop(c.currentTime + 0.7);
  if (prev !== route) setTimeout(() => setRoute(prev), 800);
  return Promise.resolve();
}
function TwoPi() { return Math.PI * 2; }
