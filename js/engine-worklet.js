// AudioWorklet entry: wraps EngineSynthDSP. Registered as 'engine-synth'.
import { EngineSynthDSP } from './synth-dsp.js';

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.dsp = new EngineSynthDSP(sampleRate);
    this.port.onmessage = e => this.dsp.handle(e.data);
  }
  process(_inputs, outputs) {
    const o = outputs[0];
    this.dsp.render(o[0], o[1] || o[0], o[0].length);
    return true;
  }
}
registerProcessor('engine-synth', EngineProcessor);
