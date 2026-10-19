// Six engine profiles. Each drives both the drivetrain (gears, rpm) and the synth DSP (synth block).
// Gears are described by top speed at the redline: rpm = redline * kmh / gearTopKmh[gear].
// Names/descriptions carry en + ua. synth params follow the pulse model in synth-dsp.js.

export const ENGINES = {
  v12: {
    id: 'v12',
    name: { en: 'V12 Supercar', ua: 'V12 Суперкар' },
    description: { en: 'A full rumble at idle, screaming to 9,000 rpm.', ua: 'Потужне урчання на холостому, лемент до 9 000 об/хв.' },
    examples: 'Lamborghini Aventador, Ferrari 812 Superfast, Aston Martin DBS',
    idleRpm: 1000, launchRpm: 4200, redline: 9000, revUp: 0.85, revDown: 2.2,
    gearTopKmh: [80, 122, 165, 210, 255, 300, 340], shiftLight: 3000, shiftHard: 8700, downLight: 2400, downHard: 5200,
    synth: { cylinders: 12, redline: 9000, limiterRpm: 8950, pulseDeg: 28, cylinderSpread: 0.28, timingSpread: 0.01, combustionSpread: 0.3, timingJitter: 0.002, idleAmp: 0.35,
      flowNoise: 0.25, flowNoiseHz: 1800, bankGain: [1, 0.82], pipesMs: [2.2, 2.6], pipeFeedback: 0.35, pipeDamp: 0.55,
      muffler: { hz: 1000, valve: 1.2, perRpm: 1.0 }, resonators: [[90, 1.2, 0.4], [320, 2, 0.35], [1250, 3, 0.2]], dry: 0.7,
      intake: { hz: 600, perRpm: 0.12, q: 2, amp: 0.35 }, drive: 1.3, popRate: 3.0, popGain: 3.12, output: 0.5 }
  },
  v8it: {
    id: 'v8it',
    name: { en: 'Italian V8', ua: 'Італійський V8' },
    description: { en: 'A flat-plane V8. A high, raw howl all the way to 9,000 rpm.', ua: 'Плоский V8. Високе, різке виття аж до 9 000 об/хв.' },
    examples: 'Ferrari 458 Italia, Ferrari F8 Tributo, McLaren 720S',
    idleRpm: 1000, launchRpm: 4500, redline: 9000, revUp: 0.7, revDown: 1.9,
    gearTopKmh: [78, 118, 160, 205, 250, 295, 330], shiftLight: 3000, shiftHard: 8800, downLight: 2400, downHard: 5200,
    synth: { cylinders: 8, redline: 9000, limiterRpm: 8950, pulseDeg: 30, banks: [0, 1, 0, 1, 0, 1, 0, 1], cylinderSpread: 0.2, timingSpread: 0.008, combustionSpread: 0.25, timingJitter: 0.002, idleAmp: 0.33,
      flowNoise: 0.3, flowNoiseHz: 2400, bankGain: [1, 0.85], pipesMs: [1.9, 2.2], pipeFeedback: 0.38, pipeDamp: 0.5,
      muffler: { hz: 1200, valve: 1.3, perRpm: 1.1 }, resonators: [[110, 1.3, 0.35], [480, 2.5, 0.35], [1600, 3, 0.25]], dry: 0.65,
      intake: { hz: 700, perRpm: 0.14, q: 2, amp: 0.3 }, drive: 1.5, popRate: 3.0, popGain: 3.12, output: 0.5 }
  },
  f6: {
    id: 'f6',
    name: { en: 'Flat-6 GT', ua: 'Flat-6 GT' },
    description: { en: 'A boxer engine. Deep boxer rhythm, metallic howl to 9,000 rpm.', ua: 'Опозитний двигун. Глибокий боксерський ритм, металеве виття до 9 000 об/хв.' },
    examples: 'Porsche 911 GT3, Porsche 911 GT3 RS, Porsche 718 Cayman GT4',
    idleRpm: 950, launchRpm: 4000, redline: 9000, revUp: 0.75, revDown: 2.0,
    gearTopKmh: [70, 108, 145, 182, 220, 260, 318], shiftLight: 3000, shiftHard: 8800, downLight: 2300, downHard: 5000,
    synth: { cylinders: 6, redline: 9000, limiterRpm: 8950, pulseDeg: 48, uneven: [0, 0.008, -0.006, 0.005, -0.003, 0.007], banks: [0, 1, 0, 1, 0, 1], cylinderSpread: 0.28, combustionSpread: 0.3, timingJitter: 0.0025, idleAmp: 0.32,
      flowNoise: 0.3, flowNoiseHz: 2200, bankGain: [1, 0.75], pipesMs: [2.6, 3.1], pipeFeedback: 0.4, pipeDamp: 0.5,
      muffler: { hz: 800, valve: 1.4, perRpm: 1.2 }, resonators: [[70, 1.2, 0.45], [260, 2, 0.3], [1100, 4, 0.25]], dry: 0.65,
      intake: { hz: 500, perRpm: 0.15, q: 2.5, amp: 0.42 }, drive: 1.5, popRate: 3.6, popGain: 3.12, output: 0.5 }
  },
  v8us: {
    id: 'v8us',
    name: { en: 'V8 Muscle', ua: 'V8 Muscle' },
    description: { en: 'An American V8. Deep, lumpy burble and plenty of pops.', ua: 'Американський V8. Глибокий, нерівний бурбл і багато пострілів.' },
    examples: 'Ford Mustang GT, Chevrolet Corvette, Dodge Challenger',
    idleRpm: 750, launchRpm: 3200, redline: 6800, revUp: 1.1, revDown: 2.4,
    gearTopKmh: [72, 118, 170, 225, 285, 330], shiftLight: 2300, shiftHard: 6500, downLight: 1700, downHard: 4000,
    synth: { cylinders: 8, redline: 6800, limiterRpm: 6750, pulseDeg: 30, banks: [0, 1, 1, 0, 1, 0, 0, 1], cylinderSpread: 0.25, timingSpread: 0.008, combustionSpread: 0.4, timingJitter: 0.003, idleAmp: 0.38,
      flowNoise: 0.3, flowNoiseHz: 1600, bankGain: [1, 0.78], pipesMs: [3.0, 3.6], pipeFeedback: 0.42, pipeDamp: 0.55,
      muffler: { hz: 600, valve: 1.5, perRpm: 1.0 }, resonators: [[60, 1.2, 0.5], [220, 2, 0.3], [900, 3, 0.15]], dry: 0.7,
      intake: { hz: 400, perRpm: 0.12, q: 1.8, amp: 0.25 }, drive: 1.6, popRate: 3.9, popGain: 3.40, output: 0.5 }
  },
  i6t: {
    id: 'i6t',
    name: { en: 'Inline-6 Turbo', ua: 'Рядна шістка Turbo' },
    description: { en: 'A silky inline-six with turbo whistle and blow-off.', ua: 'Шовкова рядна шістка з турбосвистом і блоу‑оф.' },
    examples: 'BMW M3/M4, Toyota Supra, Nissan Skyline GT-R',
    idleRpm: 800, launchRpm: 3000, redline: 7200, revUp: 0.9, revDown: 2.0,
    gearTopKmh: [60, 95, 135, 175, 215, 255, 290, 320], shiftLight: 2500, shiftHard: 6900, downLight: 1800, downHard: 4200,
    synth: { cylinders: 6, redline: 7200, limiterRpm: 7150, pulseDeg: 40, banks: [0, 1, 0, 1, 0, 1], cylinderSpread: 0.15, timingSpread: 0.006, combustionSpread: 0.2, timingJitter: 0.002, idleAmp: 0.32,
      flowNoise: 0.35, flowNoiseHz: 2000, bankGain: [1, 0.9], pipesMs: [2.4, 2.6], pipeFeedback: 0.35, pipeDamp: 0.6,
      muffler: { hz: 900, valve: 1.2, perRpm: 1.0 }, resonators: [[90, 1.2, 0.35], [380, 2.5, 0.3], [1400, 4, 0.25]], dry: 0.65,
      intake: { hz: 600, perRpm: 0.12, q: 2, amp: 0.25 }, drive: 1.4, popRate: 2.7, popGain: 2.80, output: 0.5,
      turbo: { hz: 5200, whine: 0.035, bov: 0.35, spool: 0.6 } }
  },
  f1: {
    id: 'f1',
    name: { en: 'F1 V10', ua: 'F1 V10' },
    description: { en: 'Formula 1 from the 2000s. The iconic scream to 19,000 rpm.', ua: 'Формула‑1 2000‑х. Культовий лемент аж до 19 000 об/хв.' },
    examples: 'Ferrari F2004, Williams FW26, McLaren MP4-20',
    idleRpm: 3800, launchRpm: 11000, redline: 19000, revUp: 0.5, revDown: 1.2,
    gearTopKmh: [110, 145, 180, 215, 250, 285, 330], shiftLight: 11000, shiftHard: 18500, downLight: 7000, downHard: 12000,
    synth: { cylinders: 10, redline: 19000, limiterRpm: 18900, pulseDeg: 24, banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], cylinderSpread: 0.12, timingSpread: 0.005, combustionSpread: 0.15, timingJitter: 0.0015, idleAmp: 0.3,
      flowNoise: 0.25, flowNoiseHz: 3000, bankGain: [1, 0.9], pipesMs: [1.1, 1.25], pipeFeedback: 0.3, pipeDamp: 0.45,
      muffler: { hz: 3500, valve: 0.5, perRpm: 1.0 }, resonators: [[180, 1.2, 0.3], [900, 2, 0.35], [2800, 3, 0.3]], dry: 0.6,
      intake: { hz: 1200, perRpm: 0.15, q: 2, amp: 0.28 }, drive: 1.4, popRate: 1.5, popGain: 2.40, output: 0.45 }
  },
  bmw: {
    id: 'bmw',
    name: { en: 'BMW V10', ua: 'BMW V10' },
    description: { en: 'The M5 V10. A metallic, high-strung howl to 8,250 rpm.', ua: 'V10 від M5. Металеве, напружене виття до 8 250 об/хв.' },
    examples: 'BMW M5 E60, BMW M6 E63, BMW S85',
    idleRpm: 900, launchRpm: 4000, redline: 8250, revUp: 0.7, revDown: 1.9,
    gearTopKmh: [62, 100, 140, 180, 220, 258, 300], shiftLight: 2800, shiftHard: 8050, downLight: 2200, downHard: 4800,
    synth: { cylinders: 10, redline: 8250, limiterRpm: 8200, pulseDeg: 24, banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      cylinderSpread: 0.16, timingSpread: 0.006, combustionSpread: 0.2, timingJitter: 0.002, idleAmp: 0.32,
      flowNoise: 0.28, flowNoiseHz: 2600, bankGain: [1, 0.88], pipesMs: [1.6, 1.85], pipeFeedback: 0.34, pipeDamp: 0.48,
      muffler: { hz: 1400, valve: 1.25, perRpm: 1.15 }, resonators: [[120, 1.2, 0.34], [620, 2.2, 0.34], [2100, 3, 0.28]], dry: 0.64,
      intake: { hz: 850, perRpm: 0.14, q: 2, amp: 0.34 }, drive: 1.45, popRate: 3.0, popGain: 2.90, output: 0.5 }
  },
  amg: {
    id: 'amg',
    name: { en: 'AMG V8 6.2', ua: 'AMG V8 6.2' },
    description: { en: 'A big naturally aspirated AMG V8. Thunderous idle, hard pull to 7,200 rpm.', ua: 'Великий атмосферний V8 від AMG. Громовий холостий, різкий підхват до 7 200 об/хв.' },
    examples: 'Mercedes-AMG C63 W204, E63 AMG, SLS AMG',
    idleRpm: 700, launchRpm: 3400, redline: 7200, revUp: 0.95, revDown: 2.3,
    gearTopKmh: [70, 112, 160, 210, 260, 305, 330], shiftLight: 2400, shiftHard: 6950, downLight: 1800, downHard: 4300,
    synth: { cylinders: 8, redline: 7200, limiterRpm: 7150, pulseDeg: 30, banks: [0, 1, 1, 0, 1, 0, 0, 1],
      cylinderSpread: 0.24, timingSpread: 0.008, combustionSpread: 0.36, timingJitter: 0.003, idleAmp: 0.40,
      flowNoise: 0.3, flowNoiseHz: 1700, bankGain: [1, 0.8], pipesMs: [2.8, 3.3], pipeFeedback: 0.4, pipeDamp: 0.52,
      muffler: { hz: 800, valve: 1.45, perRpm: 1.05 }, resonators: [[70, 1.2, 0.48], [260, 2, 0.32], [1100, 3, 0.2]], dry: 0.68,
      intake: { hz: 480, perRpm: 0.13, q: 1.9, amp: 0.3 }, drive: 1.55, popRate: 3.6, popGain: 3.30, output: 0.5 }
  },
  p911t: {
    id: 'p911t',
    name: { en: 'Porsche Flat-6 Turbo', ua: 'Porsche Flat-6 Turbo' },
    description: { en: 'A turbocharged boxer. Flat-six beat with turbo whistle and blow-off to 7,200 rpm.', ua: 'Турбований боксер. Опозитний ритм із турбосвистом і блоу‑оф до 7 200 об/хв.' },
    examples: 'Porsche 911 Turbo S 992, 911 Carrera S, Macan Turbo',
    idleRpm: 820, launchRpm: 3200, redline: 7200, revUp: 0.8, revDown: 2.0,
    gearTopKmh: [65, 100, 140, 180, 220, 260, 300, 330], shiftLight: 2500, shiftHard: 6950, downLight: 1900, downHard: 4200,
    synth: { cylinders: 6, redline: 7200, limiterRpm: 7150, pulseDeg: 44, uneven: [0, 0.006, -0.005, 0.004, -0.003, 0.006], banks: [0, 1, 0, 1, 0, 1],
      cylinderSpread: 0.22, combustionSpread: 0.26, timingJitter: 0.002, idleAmp: 0.33,
      flowNoise: 0.33, flowNoiseHz: 2100, bankGain: [1, 0.8], pipesMs: [2.5, 2.9], pipeFeedback: 0.37, pipeDamp: 0.55,
      muffler: { hz: 850, valve: 1.3, perRpm: 1.05 }, resonators: [[80, 1.2, 0.4], [300, 2.2, 0.3], [1250, 3.5, 0.24]], dry: 0.65,
      intake: { hz: 560, perRpm: 0.14, q: 2.2, amp: 0.36 }, drive: 1.45, popRate: 2.8, popGain: 2.80, output: 0.5,
      turbo: { hz: 4800, whine: 0.04, bov: 0.4, spool: 0.55 } }
  }
};

export const ENGINE_ORDER = ['v12', 'v8it', 'f6', 'v8us', 'i6t', 'f1', 'bmw', 'amg', 'p911t'];
