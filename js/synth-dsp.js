// EngineSynthDSP — a pure sample-by-sample combustion-engine model. No Web Audio, no DOM, no deps.
// Shared by the AudioWorklet (engine-worklet.js) and the ScriptProcessor fallback (synth-audio.js).
//
// Per sample: crank phase (one 4-stroke cycle = 720°) → each cylinder fires at its point in the firing
// order → an exhaust pulse (a fixed slice of crank rotation, so character holds across the rev range)
// plus flow noise into its bank → per-bank exhaust pipe (lossy feedback comb) → muffler low-pass that
// opens with load → stereo pan per bank → 3 body resonators → intake roar → afterfire pops → turbo →
// DC block → soft saturation (tanh). Messages drive it: profile / state / ignition / crank / on / event.

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  set(type, sr, freq, q) {
    const w = TWO_PI * Math.min(freq, sr * 0.45) / sr, s = Math.sin(w), c = Math.cos(w), a = s / (2 * q), a0 = 1 + a;
    if (type === 'bandpass') { this.b0 = a / a0; this.b1 = 0; this.b2 = -a / a0; }
    else { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; }
    this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
  }
  run(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}

class Pipe {
  constructor(n) { this.buf = new Float32Array(n); this.i = 0; this.lp = 0; this.delay = 100; this.fb = 0.4; this.damp = 0.5; }
  run(x) {
    const n = this.buf.length; let r = this.i - this.delay; while (r < 0) r += n;
    const r0 = Math.floor(r), frac = r - r0;
    const d = this.buf[r0] * (1 - frac) + this.buf[(r0 + 1) % n] * frac;
    this.lp += (d - this.lp) * (1 - this.damp);
    const y = x + this.fb * this.lp;
    this.buf[this.i] = y; this.i = (this.i + 1) % n; return y;
  }
}

const SHAPE_N = 512, SHAPE = new Float32Array(SHAPE_N + 1);
(() => { const a = 1.2, b = 2.6; let peak = 0; for (let i = 0; i <= SHAPE_N; i++) { SHAPE[i] = Math.pow(i / SHAPE_N, a) * Math.pow(1 - i / SHAPE_N, b); if (SHAPE[i] > peak) peak = SHAPE[i]; } for (let i = 0; i <= SHAPE_N; i++) SHAPE[i] /= peak; })();
const shapeAt = phi => { const x = phi * SHAPE_N, i = x | 0, f = x - i; return SHAPE[i] * (1 - f) + SHAPE[i + 1] * f; };

export class EngineSynthDSP {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.rpm = 900; this.load = 0; this.overrunMix = 0; this.level = 0;
    this.target = { rpm: 900, load: 0, overrun: false };
    this.on = false; this.cycle = 0;
    this.banks = [this._bank(), this._bank()];
    this.muffler = [new Biquad(), new Biquad()];
    this.intake = new Biquad(); this.popFilter = new Biquad(); this.bangFilter = new Biquad();
    this.resonators = [];
    this.pop = 0; this.popAmp = 0; this.bang = 0; this.bangAmp = 0; this.cluster = 0; this.burble = 0;
    this.cranking = false; this.starterPhase = 0; this.starterLevel = 0; this.starterNoise = new Biquad();
    this.ignitionOff = false; this.offTime = 0; this.stopped = false; this.clunk = 0; this.clunkPhase = 0;
    this.boost = 0; this.turboPhase = 0; this.bov = 0; this.bovFilter = new Biquad();
    this.dc = 0; this.dcOut = 0; this.dcR = 0; this.dcOutR = 0; this.blockCount = 0;
    this.samples = 0; this.lastMsg = 0; this.rpmStep = 0; this.rampLeft = 0;
    const rd = [0.0073, 0.0111, 0.0097, 0.0137]; this.room = [];
    for (let i = 0; i < 4; i++) { const len = Math.max(1, Math.round(rd[i] * sampleRate)); this.room.push({ buf: new Float32Array(len), pos: 0, lp: 0 }); }
    this.p = null; this._cranked = false;
    // Live user mix (multipliers, 0..2): set from the menu, applied where each part is used.
    // popRate: how often they come (0 = off). popChar: 0 = natural (body through the pipe),
    // 1 = sharp (a bright crack on top).
    // exhaust = the pipe/muffler note (what you mostly hear in the car), mech = induction/airbox
    this.mix = { exhaust: 1, mech: 1, pops: 1, turbo: 1, popRate: 1, popChar: 0.5 };
  }
  get popG() { return this.p.popGain * this.mix.pops; }
  _bank() { return { sig: 0, noise: 0, pipe: new Pipe(4096), aftT: -1, aftLen: 1, aftAmp: 0, pan: 0 }; }

  handle(msg) {
    if (!msg) return; const p = this.p;
    if (msg.type === 'profile') this.setProfile(msg.profile);
    else if (msg.type === 'state') {
      if (msg.overrun && !this.target.overrun && p && this.rpm > p.redline * 0.5) {
        this.triggerBang(0.55 + 0.45 * this.rpm / p.redline); this.burble = 0.9;
        if (p.turbo && this.boost > 0.3) this.bov = this.boost;
      }
      const gap = clamp(this.samples - this.lastMsg, 0.008 * this.sr, 0.1 * this.sr);
      this.lastMsg = this.samples;
      this.target.rpm = msg.rpm; this.target.load = msg.load; this.target.overrun = !!msg.overrun;
      this.rampLeft = Math.round(gap); this.rpmStep = (msg.rpm - this.rpm) / this.rampLeft;
    }
    else if (msg.type === 'mix') { for (const k in this.mix) if (typeof msg[k] === 'number') this.mix[k] = msg[k]; }
    else if (msg.type === 'on') this.on = msg.on;
    else if (msg.type === 'crank') this.cranking = msg.on;
    else if (msg.type === 'ignition') { this.ignitionOff = !msg.on; this.offTime = 0; this.stopped = false; }
    else if (msg.type === 'event' && p) {
      if (msg.kind === 'upshift' && this.load > 0.35) { this.afterfire(0, 0.6 + 0.4 * this.load, 2.5); this.afterfire(1, 0.5 + 0.4 * this.load, 2.0); }
      else if (msg.kind === 'downshift') this.burble = 0.6;
    }
  }

  setProfile(p) {
    this.p = p; const sr = this.sr, n = p.cylinders; this.cyl = [];
    for (let i = 0; i < n; i++) {
      const offset = (i / n + (p.uneven ? (p.uneven[i] || 0) : (Math.random() - 0.5) * (p.timingSpread || 0)) + 1) % 1;
      this.cyl.push({ offset, bank: p.banks ? p.banks[i] : i % 2, gain: 1 + (Math.random() - 0.5) * 2 * (p.cylinderSpread || 0), next: Math.floor(this.cycle) + 1 + offset, start: -1, amp: 0 });
    }
    this.width = (p.pulseDeg || 30) / 720;
    this.popDecay = Math.exp(-1 / (0.0025 * sr));
    this.noiseK = 1 - Math.exp(-TWO_PI * (p.flowNoiseHz || 1800) / sr);
    const pans = p.pan || [-0.4, 0.4];
    for (let b = 0; b < 2; b++) { const pipe = this.banks[b].pipe; pipe.delay = p.pipesMs[b] * 0.001 * sr; pipe.fb = p.pipeFeedback; pipe.damp = p.pipeDamp; this.banks[b].pan = pans[b]; }
    this.resonators = (p.resonators || []).map(r => { const f = new Biquad(); f.set('bandpass', sr, r[0], r[1]); return { filter: f, gain: r[2] }; });
    this.popFilter.set('bandpass', sr, 1800, 1.0); this.bangFilter.set('lowpass', sr, 180, 0.9); this.bangDecay = Math.exp(-1 / (0.04 * sr));
    this.starterNoise.set('bandpass', sr, 1200, 1.5); this.bovFilter.set('bandpass', sr, 3200, 0.9); this.bovDecay = Math.exp(-1 / (0.3 * sr)); this.clunkDecay = Math.exp(-1 / (0.16 * sr));
    this.cluster = 0; this.burble = 0; this.ignitionOff = false; this.stopped = false; this.updateFilters();
  }

  updateFilters() {
    const p = this.p, sr = this.sr;
    const hz = p.muffler.hz * (1 + p.muffler.valve * this.load) * (1 + (p.muffler.perRpm || 0) * this.rpm / p.redline);
    this.muffler[0].set('lowpass', sr, hz, 0.75); this.muffler[1].set('lowpass', sr, hz * 1.12, 0.6);
    this.intake.set('bandpass', sr, p.intake.hz + (p.intake.perRpm || 0) * this.rpm, p.intake.q);
  }

  fire(c) {
    const p = this.p;
    if (this.cranking) return;
    if (this.ignitionOff && (this.offTime > 0.18 || Math.random() < 0.5 + this.offTime * 2.5)) return;
    if (this.rpm > p.limiterRpm && this.load > 0.3 && Math.random() < 0.6) { if (Math.random() < 0.12) this.afterfire(c.bank, 0.6, 1.5); return; }
    const jitter = (p.combustionSpread || 0.3) * (1 - 0.4 * this.load) * (1 - 0.6 * this.overrunMix);
    let amp = (p.idleAmp + (1 - p.idleAmp) * this.load) * c.gain * (1 + (Math.random() - 0.5) * 2 * jitter);
    amp *= 1 - 0.55 * this.overrunMix;
    if (this.overrunMix > 0.5 && this.rpm > p.redline * 0.25) {
      if (this.cluster > 0) { if (Math.random() < 0.55) { this.afterfire(c.bank, 0.5 + 0.5 * Math.random(), 2.2 + 2.3 * Math.random()); this.cluster--; } }
      else { const fps = this.rpm / 120 * p.cylinders; if (Math.random() < p.popRate * this.mix.popRate * (1 + 3 * this.burble) / fps) this.cluster = 2 + (Math.random() * 3 | 0); }
    }
    c.start = this.cycle; c.amp = amp;
  }
  afterfire(bank, strength, ms) {
    if (this.mix.popRate <= 0) return;
    const ch = this.mix.popChar;
    // natural = a long, dull burn with body through the pipe; sharp = a short, bright crack on top
    const b = this.banks[bank], amp = strength * this.popG * 1.6 * (1.7 - 1.2 * ch);
    if (b.aftT >= 0 && b.aftAmp > amp) return;
    b.aftT = 0; b.aftLen = Math.max(8, ms * (1.7 - 1.1 * ch) * 0.001 * this.sr); b.aftAmp = amp;
    this.pop = 1; this.popAmp = strength * this.popG * 0.16 * (0.2 + 2.2 * ch);   // crack bypasses the muffler
    // dull and slow when natural, bright and snappy when sharp
    this.popFilter.set('bandpass', this.sr, 650 + 2300 * ch, 0.75 + 0.7 * ch);
    this.popDecay = Math.exp(-1 / ((0.0075 - 0.0052 * ch) * this.sr));
  }
  triggerBang(s) {
    if (this.mix.popRate <= 0) return;
    this.afterfire(0, s, 8); this.afterfire(1, s * 0.9, 7);
    this.bang = 1; this.bangAmp = s * this.popG * 1.5 * (1.25 - 0.5 * this.mix.popChar);
  }

  render(outL, outR, n) {
    const p = this.p; if (!p) { for (let i = 0; i < n; i++) { outL[i] = 0; outR[i] = 0; } return; }
    if (++this.blockCount % 2 === 0) this.updateFilters();
    this.burble = Math.max(0, this.burble - n / this.sr);
    if (p.turbo) { const want = this.overrunMix > 0.5 ? 0 : Math.min(1, this.load * 1.2) * Math.min(1, this.rpm / (p.redline * 0.45)); const tau = want > this.boost ? p.turbo.spool : 0.15; this.boost += (want - this.boost) * Math.min(1, n / this.sr / tau); }
    this.starterLevel += ((this.cranking ? 1 : 0) - this.starterLevel) * Math.min(1, n / this.sr / 0.03);
    if (this.ignitionOff) { this.offTime += n / this.sr; if (!this.stopped && this.rpm < 60) { this.stopped = true; this.clunk = 1; this.clunkPhase = 0; } }
    const loadK = 1 - Math.exp(-1 / (0.04 * this.sr)), overrunK = 1 - Math.exp(-1 / (0.15 * this.sr)), levelK = 1 - Math.exp(-1 / (0.15 * this.sr));
    const cyl = this.cyl, banks = this.banks, res = this.resonators, W = this.width, sr = this.sr;

    for (let i = 0; i < n; i++) {
      if (this.rampLeft > 0) { this.rpm += this.rpmStep; this.rampLeft--; }
      this.samples++;
      this.load += ((this.target.overrun ? 0 : this.target.load) - this.load) * loadK;
      this.overrunMix += ((this.target.overrun ? 1 : 0) - this.overrunMix) * overrunK;
      this.level += ((this.on ? 1 : 0) - this.level) * levelK;

      this.cycle += this.rpm / 120 / sr;
      banks[0].sig = 0; banks[1].sig = 0;
      for (let k = 0; k < cyl.length; k++) {
        const c = cyl[k];
        if (this.cycle >= c.next) { this.fire(c); c.next = Math.round(c.next - c.offset) + 1 + c.offset + (Math.random() - 0.5) * (p.timingJitter || 0); }
        if (c.start >= 0) { const phi = (this.cycle - c.start) / W; if (phi < 1) banks[c.bank].sig += c.amp * shapeAt(phi); else c.start = -1; }
      }

      let L = 0, R = 0, pulses = 0;
      for (let b = 0; b < 2; b++) {
        const bank = banks[b];
        bank.noise += ((Math.random() * 2 - 1) - bank.noise) * this.noiseK;
        let x = bank.sig * (1 + p.flowNoise * bank.noise * 3);
        if (bank.aftT >= 0) { const a = bank.aftAmp * shapeAt(bank.aftT / bank.aftLen); x += a; bank.sig += a; if (++bank.aftT >= bank.aftLen) bank.aftT = -1; }
        pulses += bank.sig;
        const ex = this.muffler[b].run(bank.pipe.run(x)) * p.bankGain[b];
        const panL = Math.sqrt(0.5 * (1 - bank.pan)), panR = Math.sqrt(0.5 * (1 + bank.pan));
        let body = ex * p.dry; for (let r = 0; r < res.length; r++) body += res[r].filter.run(ex) * res[r].gain;
        body *= this.mix.exhaust;
        L += body * panL; R += body * panR;
      }

      const intake = this.intake.run(pulses * (0.6 + 0.4 * (Math.random() * 2 - 1))) * p.intake.amp * this.mix.mech * (0.15 + this.load);
      L += intake; R += intake;

      let pop = 0;
      if (this.pop > 0.001) { pop = this.popFilter.run((Math.random() * 2 - 1) * this.pop * this.popAmp); this.pop *= this.popDecay; }
      if (this.bang > 0.001) { pop += this.bangFilter.run((Math.random() * 2 - 1) * this.bang * this.bangAmp); this.bang *= this.bangDecay; }
      L += pop; R += pop;

      let starter = 0;
      if (this.starterLevel > 0.001) {
        this.starterPhase += TWO_PI * 38 / sr;
        const comp = Math.sin(TWO_PI * this.cycle * p.cylinders / 2 * 2);
        const whirr = Math.sin(this.starterPhase * 18) * 0.5 + Math.sin(this.starterPhase * 27) * 0.3 + this.starterNoise.run(Math.random() * 2 - 1) * 0.2;
        starter = this.starterLevel * (whirr * (0.55 + 0.45 * comp) * 0.35 + Math.max(0, comp) * Math.sin(this.starterPhase * 1.6) * 0.35);
      }
      if (this.ignitionOff && !this.stopped && this.rpm < 900) { const cp = Math.sin(TWO_PI * this.cycle * p.cylinders); starter += Math.max(0, cp) * Math.sin(TWO_PI * this.cycle * p.cylinders * 6) * 0.12 * (this.rpm / 900); }
      if (this.clunk > 0.001) { this.clunkPhase += TWO_PI / sr; starter += this.clunk * (Math.sin(this.clunkPhase * 48) * 0.55 + Math.sin(this.clunkPhase * 9) * 0.25); this.clunk *= this.clunkDecay; }
      L += starter; R += starter;

      if (p.turbo) {
        this.turboPhase += TWO_PI * p.turbo.hz * (0.35 + 0.65 * this.boost) / sr; if (this.turboPhase > TWO_PI) this.turboPhase -= TWO_PI;
        let turbo = Math.sin(this.turboPhase) * this.boost * this.boost * p.turbo.whine * this.mix.turbo;
        if (this.bov > 0.001) { turbo += this.bovFilter.run(Math.random() * 2 - 1) * this.bov * p.turbo.bov * this.mix.turbo; this.bov *= this.bovDecay; }
        L += turbo; R += turbo;
      }

      const rm = this.room; let rl = 0, rr = 0;
      for (let q = 0; q < 4; q++) { const dd = rm[q], inp = (q & 1 ? R : L), o = dd.buf[dd.pos]; dd.lp += 0.35 * (o - dd.lp); dd.buf[dd.pos] = inp + dd.lp * 0.42; dd.pos = (dd.pos + 1) % dd.buf.length; if (q < 2) rl += dd.lp; else rr += dd.lp; }
      L += rl * 0.2; R += rr * 0.2;

      this.dcOut = L - this.dc + 0.9975 * this.dcOut; this.dc = L;
      this.dcOutR = R - this.dcR + 0.9975 * this.dcOutR; this.dcR = R;
      const g = p.output * this.level;
      outL[i] = Math.tanh(this.dcOut * p.drive) / Math.tanh(p.drive) * g;
      outR[i] = Math.tanh(this.dcOutR * p.drive) / Math.tanh(p.drive) * g;
    }
  }
}
