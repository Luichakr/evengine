// The Web Audio graph around the DSP:
//   DSP node (2ch) → sourceGain → EQ_CLEAN → split dry(0.88)/wet(0.12 → convolver) → compressor → output
// Worklet is the main path; ScriptProcessor (buffer 4096) is the fallback for older car Chromium.
import { EngineSynthDSP } from './synth-dsp.js';
import { buildEq, impulse } from './synth-audio-eq.js';
import { context, output } from './audio-out.js';

export class SynthAudio {
  constructor() { this.ctx = null; this.node = null; this.post = () => {}; this.kind = ''; this.ready = null; this.profile = null; }

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const ctx = this.ctx = context();
      const srcGain = ctx.createGain(); srcGain.gain.value = 1;
      const eq = buildEq(ctx);
      const dry = ctx.createGain(); dry.gain.value = 0.88;
      const wet = ctx.createGain(); wet.gain.value = 0.12;
      const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 0.45, 0.5);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -3; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
      // graph after the DSP node (node connected below once created)
      srcGain.connect(eq.input);
      eq.output.connect(dry); eq.output.connect(conv); conv.connect(wet);
      dry.connect(comp); wet.connect(comp); comp.connect(output());
      this._srcGain = srcGain; this._wet = wet;
      if (this.space != null) this.setSpace(this.space);

      // Try the worklet with a 3s timeout; fall back to ScriptProcessor.
      // The worklet module is assembled from synth-dsp.js as a Blob (no cross-file import), so it loads
      // even on car browsers that reject module imports inside AudioWorklet.
      let usedWorklet = false;
      try {
        const dspSrc = await fetch('js/synth-dsp.js').then(r => r.text());
        const workletSrc = dspSrc.replace(/export\s+class\s+EngineSynthDSP/, 'class EngineSynthDSP') +
          "\nregisterProcessor('engine-synth', class extends AudioWorkletProcessor{" +
          "constructor(){super();this.dsp=new EngineSynthDSP(sampleRate);this.port.onmessage=e=>this.dsp.handle(e.data);}" +
          "process(_i,o){const out=o[0];this.dsp.render(out[0],out[1]||out[0],out[0].length);return true;}});";
        const url = URL.createObjectURL(new Blob([workletSrc], { type: 'application/javascript' }));
        await Promise.race([
          ctx.audioWorklet.addModule(url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('worklet timeout')), 3000))
        ]);
        URL.revokeObjectURL(url);
        this.node = new AudioWorkletNode(ctx, 'engine-synth', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        this.post = m => this.node.port.postMessage(m);
        usedWorklet = true;
      } catch (e) {
        const dsp = new EngineSynthDSP(ctx.sampleRate);
        const sp = ctx.createScriptProcessor(4096, 1, 2);     // 1 input ch: some old Chromium need it to fire
        sp.onaudioprocess = ev => { const o = ev.outputBuffer; dsp.render(o.getChannelData(0), o.getChannelData(1), o.length); };
        this.node = sp; this.post = m => dsp.handle(m);
      }
      this.kind = usedWorklet ? 'AudioWorklet' : 'ScriptProcessor';
      this.node.connect(srcGain);
      if (this.profile) this.post({ type: 'profile', profile: this.profile });
      if (this.mix) this.post(Object.assign({ type: 'mix' }, this.mix));
    })();
    return this.ready;
  }

  setProfile(p) { this.profile = p; this.post({ type: 'profile', profile: p }); if (this.mix) this.setMix(this.mix); }
  setMix(m) { this.mix = m; this.post(Object.assign({ type: 'mix' }, m)); }   // engine / pops / turbo / intake
  // How much room the engine sits in: 0 = dry, 1 = the most reverb we allow
  setSpace(v) { this.space = v; if (this._wet) this._wet.gain.setTargetAtTime(v * 0.24, this.ctx.currentTime, 0.05); }
  on(v) { this.post({ type: 'on', on: v }); }
  crank(v) { this.post({ type: 'crank', on: v }); }
  ignition(v) { this.post({ type: 'ignition', on: v }); }
  update(s) { this.post({ type: 'state', rpm: s.rpm, load: s.load, overrun: s.overrun }); if (s.event) this.post({ type: 'event', kind: s.event }); }
}
