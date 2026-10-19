// Tiny i18n: uk (Ukrainian) + en. Stored lang in localStorage ge.lang. No reload on switch —
// applyStatic() refills every [data-i18n] node and listeners rebuild the cluster.

const STRINGS = {
  uk: {
    appName: 'EV ENGINE',
    tagline: 'Звук для вашого електрокара',
    ignite: 'ЗАПУСТИТИ',
    start: 'СТАРТ',
    startHint: 'Натисніть старт, коли авто стоїть',
    stopEngine: 'ЗУПИНИТИ ДВИГУН',
    holdToRev: 'ТРИМАЙТЕ, ЩОБ ГАЗУВАТИ',
    changeEngine: 'Змінити двигун',
    chooseEngine: 'Оберіть двигун',
    volumeTitle: 'Додайте гучності в авто',
    volumeNote: 'Звук двигуна йде через колонки авто. Керуйте гучністю на кермі.',
    gearLabel: 'ПЕРЕДАЧА',
    rpmUnit: 'ОБ/ХВ',
    kmhUnit: 'КМ/ГОД',
    menu: 'Меню',
    demo: 'Демо‑поїздка',
    demoNote: 'імітація руху, без GPS',
    stats: 'Анонімна статистика',
    statsNote: 'без cookies, нічого, що можна пов’язати з вами',
    soundCheckTitle: 'Немає звуку? Перевірка звуку',
    soundCheckHint: 'Натискайте кнопки по черзі й відзначте, які чути через колонки авто.',
    remindTitle: 'Нагадати в авто',
    safetyTitle: 'ПЕРЕД ПОЇЗДКОЮ',
    safety1: 'За кермом — ви. Відповідальність за керування та дотримання ПДР завжди лежить на вас.',
    safety2: 'Тримайте гучність такою, щоб чути трафік, сирени та сигнали.',
    safety3: 'Увага: керуйте додатком, лише коли авто стоїть.',
    safetyDisclaimer: 'EV ENGINE — безкоштовний і надається «як є». Ви користуєтеся ним на власний ризик.',
    safetyBtn: 'Я ЗГОДЕН'
  },
  en: {
    appName: 'EV ENGINE',
    tagline: 'Add sound to your EV',
    ignite: 'TAP TO IGNITE',
    start: 'START',
    startHint: 'Press start while the car is standing still',
    stopEngine: 'STOP ENGINE',
    holdToRev: 'HOLD TO REV',
    changeEngine: 'Change engine',
    chooseEngine: 'Choose engine',
    volumeTitle: 'Turn the car’s volume well up',
    volumeNote: 'The engine sound plays through the car’s speakers. Use the volume on the steering wheel.',
    gearLabel: 'GEAR',
    rpmUnit: 'RPM',
    kmhUnit: 'KM/H',
    menu: 'Menu',
    demo: 'Demo drive',
    demoNote: 'simulated drive, no GPS',
    stats: 'Anonymous usage statistics',
    statsNote: 'no cookies, nothing that can be traced to you',
    soundCheckTitle: 'No sound? Sound check',
    soundCheckHint: 'Tap the buttons one by one and note which you hear through the car speakers.',
    remindTitle: 'Remind me in my car',
    safetyTitle: 'BEFORE YOU DRIVE',
    safety1: 'You are the driver. You are always responsible for your driving and for following the traffic rules.',
    safety2: 'Keep the volume at a level where you can always hear the traffic, sirens and horns.',
    safety3: 'Only use the app while the car is standing still.',
    safetyDisclaimer: 'EV ENGINE is free and provided as is. You use it at your own risk.',
    safetyBtn: 'I UNDERSTAND'
  }
};

let lang = 'uk';
const listeners = [];

export function getLang() { return lang; }
export function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key; }
// pick({en, ua}) — engine names/descriptions use the 'ua' key for Ukrainian
export function pick(obj) { if (!obj) return ''; return obj[lang] || obj[lang === 'uk' ? 'ua' : lang] || obj.ua || obj.en || ''; }
export function onLangChange(fn) { listeners.push(fn); }

export function defaultLang() {
  try { const s = localStorage.getItem('ge.lang'); if (s && STRINGS[s]) return s; } catch (e) {}
  const nav = (navigator.languages || [navigator.language || 'en']).join(',');
  return /uk|ru/i.test(nav) ? 'uk' : 'en';
}

export function setLang(l) {
  if (!STRINGS[l]) l = 'en';
  lang = l;
  document.documentElement.lang = l === 'uk' ? 'uk' : 'en';
  try { localStorage.setItem('ge.lang', l); } catch (e) {}
  applyStatic();
  listeners.forEach(fn => { try { fn(l); } catch (e) {} });
}

export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.getAttribute('data-i18n'));
    if (v) el.textContent = v;
  });
  document.querySelectorAll('.lang-seg button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

// thousands separator: nbsp for uk ("9 000"), comma for en
export function formatRpm(rpm) {
  const r = Math.round(rpm / 50) * 50;
  const sep = lang === 'uk' ? ' ' : ',';
  return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
