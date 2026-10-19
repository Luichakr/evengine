// Two speed sources with the same interface: start(), stop(), sample() → { speedMs, accelMs2, t }.

function distance(a, b) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad, dLon = (b.longitude - a.longitude) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export class GpsSpeed {
  constructor(onStatus) { this.onStatus = onStatus || (() => {}); this.watchId = null; this.speed = 0; this.accel = 0; this.lastFix = null; this.status = 'off'; }
  static supported() { return 'geolocation' in navigator; }
  setStatus(s) { this.status = s; this.onStatus(s); }
  start() {
    if (!('geolocation' in navigator)) { this.setStatus('blocked'); return; }
    if (this.watchId !== null) return;
    this.setStatus('pending');
    this.watchId = navigator.geolocation.watchPosition(p => this.onFix(p), e => this.setStatus(e.code === 1 ? 'blocked' : 'off'), { enableHighAccuracy: true, maximumAge: 500, timeout: 7000 });
  }
  stop() { if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId); this.watchId = null; this.setStatus('off'); }
  onFix(pos) {
    const t = pos.timestamp || Date.now(), c = pos.coords; let v = c.speed, prev = this.lastFix;
    if ((v === null || isNaN(v)) && prev) { const dt = (t - prev.t) / 1000; v = dt > 0 ? distance(prev.coords, c) / dt : prev.speed; }
    if (v === null || isNaN(v)) v = 0; if (v < 0.4) v = 0;
    if (prev) { const dt = (t - prev.t) / 1000; if (dt > 0.02 && dt < 3) { const a = Math.max(-12, Math.min(12, (v - prev.speed) / dt)); this.accel += (a - this.accel) * 0.3; } }
    this.speed = v; this.lastFix = { t, speed: v, coords: { latitude: c.latitude, longitude: c.longitude } };
    if (this.status !== 'on') this.setStatus('on');
  }
  sample() {
    if (!this.lastFix) return { speedMs: 0, accelMs2: 0, t: performance.now() };
    const now = Date.now(), ahead = Math.max(0, Math.min(0.4, (now - this.lastFix.t) / 1000));
    if (now - this.lastFix.t > 4000) this.accel *= 0.9;
    return { speedMs: Math.max(0, this.speed + this.accel * ahead), accelMs2: this.accel, t: performance.now() };
  }
}

// A looping demo: stand, launch with two upshifts, cruise, lift-off, brake to a stop with downshifts.
const DEMO = [
  { dur: 4, accel: 0 },
  { dur: 10, accel: 4.2, fade: 0.55 },
  { dur: 12, accel: 0.6 },
  { dur: 6, accel: -2.2 },
  { dur: 10, accel: -3.4 }
];
export class DemoSpeed {
  constructor() { this.reset(); }
  static supported() { return true; }
  reset() { this.t0 = null; this.speed = 0; this.lastNow = null; this.accel = 0; }
  start() { this.reset(); }
  stop() {}
  sample() {
    const now = performance.now();
    if (this.t0 === null) { this.t0 = now; this.lastNow = now; }
    const dt = Math.min(0.1, (now - this.lastNow) / 1000); this.lastNow = now;
    const total = DEMO.reduce((s, p) => s + p.dur, 0);
    let t = ((now - this.t0) / 1000) % total, phase = DEMO[0], into = 0;
    for (let i = 0; i < DEMO.length; i++) { if (t < DEMO[i].dur) { phase = DEMO[i]; into = t / DEMO[i].dur; break; } t -= DEMO[i].dur; }
    let a = phase.accel; if (phase.fade) a *= 1 - phase.fade * into;
    this.speed = Math.max(0, this.speed + a * dt); if (this.speed === 0 && a < 0) a = 0;
    this.accel = a;
    return { speedMs: this.speed, accelMs2: a, t: now };
  }
}
