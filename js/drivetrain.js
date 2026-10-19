// Turns road speed + acceleration into rpm, gear, load, overrun and shift events, like a dual-clutch
// supercar gearbox (ignition-cut bark on upshift, throttle blip on downshift).

const FULL_LOAD_ACCEL = 3.5;
const OVERRUN_ACCEL = -0.4;
const CRUISE_LOAD = 0.22;
const CUT_TIME = 0.07;
const BLIP_TIME = 0.14;
const KICKDOWN_COOLDOWN = 1.5;
const SHIFT_COOLDOWN = 0.9;
const UPSHIFT_GAP = 0.4;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;

export class Drivetrain {
  constructor(engine) { this.setEngine(engine); }
  setEngine(e) {
    this.e = e; this.gear = 0; this.rpm = e.idleRpm; this.load = 0; this.cut = 0; this.blip = 0;
    this.kickdownTimer = 0; this.shiftTimer = 0; this.idlePhase = 0; this.startT = -1; this.offT = -1; this.settling = false;
  }
  shutdown() { this.offT = 0; this.startT = -1; }
  isOff() { return this.offT >= 0 && this.rpm <= 0; }
  start() { this.startT = 0; this.offT = -1; this.rpm = 0; }
  rpmInGear(kmh, gear) { return this.e.redline * kmh / this.e.gearTopKmh[gear]; }

  update(speedMs, accel, dt, throttle) {
    const e = this.e, kmh = Math.max(0, speedMs * 3.6);
    if (this.offT >= 0) return this.windDown(dt);
    if (this.startT >= 0) return this.startUp(dt);
    if (kmh < 2 && accel < 0.3) return this.freeRev(throttle || 0, dt);

    const overrun = accel < OVERRUN_ACCEL && kmh > 5;
    const pedal = overrun ? 0 : CRUISE_LOAD + (1 - CRUISE_LOAD) * Math.pow(clamp(accel / FULL_LOAD_ACCEL, 0, 1), 0.8);
    this.load += (pedal - this.load) * Math.min(1, dt * (pedal > this.load ? 8 : 4));

    let event = null;
    const last = e.gearTopKmh.length - 1;
    const upAt = lerp(e.shiftLight, e.shiftHard, this.load * this.load);
    const downAt = lerp(e.downLight, e.downHard, this.load * this.load);
    const slowing = overrun || accel < -0.2;
    this.cut = Math.max(0, this.cut - dt); this.blip = Math.max(0, this.blip - dt);
    this.kickdownTimer = Math.max(0, this.kickdownTimer - dt); this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    const lowerOk = this.gear > 0 && this.shiftTimer === 0 && this.rpmInGear(kmh, this.gear - 1) < upAt * 0.92;

    if (kmh < 2) this.gear = 0;
    else if (this.gear < last && !slowing && this.shiftTimer < SHIFT_COOLDOWN - UPSHIFT_GAP && this.rpmInGear(kmh, this.gear) > upAt) {
      this.gear++; this.cut = CUT_TIME; this.shiftTimer = SHIFT_COOLDOWN; event = 'upshift';
    } else if (lowerOk && this.rpmInGear(kmh, this.gear) < downAt) {
      this.gear--; this.blip = BLIP_TIME; this.shiftTimer = SHIFT_COOLDOWN; event = 'downshift';
    } else if (lowerOk && this.load > 0.85 && this.kickdownTimer === 0) {
      this.gear--; this.blip = BLIP_TIME; this.kickdownTimer = KICKDOWN_COOLDOWN; this.shiftTimer = SHIFT_COOLDOWN; event = 'downshift';
    }

    let target = this.rpmInGear(kmh, this.gear);
    if (this.gear === 0) target = Math.max(target, lerp(e.idleRpm, e.launchRpm, this.load));
    target = clamp(target, e.idleRpm, e.redline);
    const rate = this.cut > 0 || this.blip > 0 ? 30 : 16;
    this.rpm += (target - this.rpm) * Math.min(1, dt * rate);

    let load = this.load;
    if (this.cut > 0) load = 0.05; else if (this.blip > 0) load = Math.max(load, 0.6);
    return { rpm: this.rpm, gear: this.gear + 1, neutral: false, load, overrun: overrun && this.blip === 0, shifting: this.cut > 0 || this.blip > 0, event, kmh };
  }

  windDown(dt) {
    this.offT += dt; this.rpm = Math.max(0, this.rpm - (this.rpm * 3.2 + 260) * dt);
    if (this.rpm < 40) this.rpm = 0; this.load = 0;
    return { rpm: this.rpm, gear: 1, neutral: true, load: 0, overrun: false, shifting: false, event: null, kmh: 0, off: true };
  }
  startUp(dt) {
    const e = this.e, t = (this.startT += dt), CRANK = 0.85, CATCH = 0.22;
    const flare = Math.min(e.idleRpm * 2.6, e.redline * 0.4);
    let cranking = false, load = 0;
    if (t < CRANK) { cranking = true; this.rpm = 230 + 40 * Math.sin(t * 26); }
    else if (t < CRANK + CATCH) { load = 0.6; this.rpm += (flare - this.rpm) * Math.min(1, dt * 14); }
    else { this.startT = -1; this.load = 0; this.settling = true; return this.freeRev(0, dt); }
    this.load = load;
    return { rpm: this.rpm, gear: 1, neutral: true, load, overrun: false, shifting: false, event: null, kmh: 0, cranking };
  }
  freeRev(throttle, dt) {
    const e = this.e, span = e.redline - e.idleRpm; this.gear = 0; this.idlePhase += dt * 4.4;
    if (throttle > 0 || this.rpm < e.idleRpm * 1.3) this.settling = false;
    if (throttle > 0) {
      const x = (this.rpm - e.idleRpm) / span, torque = 0.7 + 0.5 * Math.sin(Math.PI * clamp(x, 0, 1));
      this.rpm += span / e.revUp * torque * dt;
      if (this.rpm >= e.redline) this.rpm = e.redline - 260;
    } else {
      const above = Math.max(0, this.rpm - e.idleRpm), tau = e.revDown / 3;
      this.rpm -= (above / tau + 350) * dt;
      const idle = e.idleRpm * (1 + 0.012 * Math.sin(this.idlePhase) + 0.006 * Math.sin(this.idlePhase * 2.7));
      if (this.rpm < idle) this.rpm += (idle - this.rpm) * Math.min(1, dt * 6);
    }
    this.load += ((throttle > 0 ? 1 : 0) - this.load) * Math.min(1, dt * 12);
    return { rpm: this.rpm, gear: 1, neutral: true, load: this.load, overrun: throttle === 0 && this.rpm > e.idleRpm * 1.3 && !this.settling, shifting: false, event: null, kmh: 0 };
  }
}
