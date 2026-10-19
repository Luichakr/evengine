// EQ_CLEAN — a gentle shaping chain applied after the DSP node. Each entry builds one BiquadFilterNode.
export const EQ_CLEAN = [
  { type: 'highpass', freq: 50, q: 0.7, gain: 0 },
  { type: 'lowshelf', freq: 90, q: 0.7, gain: 2 },
  { type: 'peaking', freq: 180, q: 1.1, gain: 1.5 },
  { type: 'peaking', freq: 1200, q: 1.0, gain: -1 },
  { type: 'highshelf', freq: 7000, q: 0.7, gain: 1 }
];

export function buildEq(ctx) {
  const nodes = EQ_CLEAN.map(s => {
    const f = ctx.createBiquadFilter();
    f.type = s.type; f.frequency.value = s.freq; f.Q.value = s.q; f.gain.value = s.gain;
    return f;
  });
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return { input: nodes[0], output: nodes[nodes.length - 1] };
}

// A short stereo impulse response — gives a mono engine some width.
export function impulse(ctx, seconds, density) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() < density ? Math.random() * 2 - 1 : 0) * Math.pow(1 - t, 3); }
  }
  return buf;
}
