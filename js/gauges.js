// The SVG instrument cluster: two dials (rpm left, speed right) with a gear badge between them (layout
// 'a', landscape) or one big rpm dial with km/h in the middle (layout 'portrait'). Built once per engine;
// each frame only the lit-tick count and the numbers change, and only when they actually change.
import { t, getLang, pick, formatRpm } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const SPEED_MAX = 240;

function el(name, attrs, parent) { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function text(parent, x, y, cls, value) { const e = el('text', { x, y, class: cls }, parent); e.textContent = value; return e; }

function arcTicks(parent, cx, cy, r, count, startDeg, sweepDeg, len) {
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const a = (startDeg + sweepDeg * i / (count - 1)) * Math.PI / 180, w = 0.012, ri = r - len;
    const p = [[r, a - w], [r, a + w], [ri, a + w * 0.6], [ri, a - w * 0.6]]
      .map(([rr, aa]) => (cx + rr * Math.cos(aa)).toFixed(1) + ',' + (cy + rr * Math.sin(aa)).toFixed(1)).join(' ');
    ticks.push(el('polygon', { points: p, class: 'tick' }, parent));
  }
  return ticks;
}
function arcLabels(parent, cx, cy, r, values, max, startDeg, sweepDeg, cls) {
  values.forEach(v => { const a = (startDeg + sweepDeg * v / max) * Math.PI / 180; text(parent, (cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a) + 8).toFixed(1), cls || 'scale', v); });
}
function gearBadge(parent, cx, cy, w, h) {
  el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, class: 'badge' }, parent);
  text(parent, cx, cy - h / 2 - 14, 'label', t('gearLabel'));
  return text(parent, cx, cy + h * 0.24, 'gear', 'N');
}
function rpmScale(redline) { const top = Math.ceil(redline / 1000), step = top > 12 ? 2 : 1, values = []; for (let v = 0; v <= top; v += step) values.push(v); return { top, values }; }
function setLit(ticks, st, lit, redFrom) {
  if (st.lit === lit) return;
  for (let i = 0; i < ticks.length; i++) { const cls = 'tick' + (i < lit ? ' on' : '') + (i >= redFrom ? ' red' : ''); if (ticks[i].getAttribute('class') !== cls) ticks[i].setAttribute('class', cls); }
  st.lit = lit;
}
const setText = (e, v) => { if (e.textContent !== v) e.textContent = v; };

function enginePick(cluster, g, engine, cx, y) {
  const name = pick(engine.name).toUpperCase();
  const grp = el('g', { class: 'engine-name' }, g);
  el('rect', { x: cx - 170, y: y - 32, width: 340, height: 50, fill: 'transparent' }, grp);
  const nameText = text(grp, cx - 8, y, '', name);
  let w = name.length * 14.4;
  try { w = Math.max(w, nameText.getComputedTextLength(), nameText.getBBox().width); } catch (e) {}
  const half = w / 2;
  el('path', { d: `M ${cx + 8 + half} ${y - 12} l 8 8 l 8 -8`, class: 'chev' }, grp);
  if (cluster.onEngineClick) grp.addEventListener('click', cluster.onEngineClick);
}

const builders = {
  a(svg, engine) {
    const s = rpmScale(engine.redline), START = 135, SWEEP = 270, N = 54;
    const g = el('g', {}, svg);
    const rpmTicks = arcTicks(g, 250, 225, 175, N, START, SWEEP, 26);
    arcLabels(g, 250, 225, 128, s.values, s.top, START, SWEEP);
    const rpmText = text(g, 250, 240, 'big', '0'); text(g, 250, 280, 'unit', t('rpmUnit'));
    const kmhTicks = arcTicks(g, 750, 225, 175, N, START, SWEEP, 26);
    arcLabels(g, 750, 225, 128, [0, 40, 80, 120, 160, 200, 240], SPEED_MAX, START, SWEEP);
    const kmhText = text(g, 750, 250, 'big xl', '0'); text(g, 750, 290, 'unit', t('kmhUnit'));
    const gear = gearBadge(g, 500, 300, 120, 92);
    enginePick(this, g, engine, 500, -2);
    this.note = text(g, 500, 408, 'note' + (this.noteVisible ? '' : ' waiting'), t('volumeNote'));
    const st = { r: {}, k: {} }, redFrom = Math.floor(N * engine.redline * 0.92 / (s.top * 1000));
    return (rpm, kmh, gearValue) => {
      setLit(rpmTicks, st.r, Math.round(N * Math.min(1, rpm / (s.top * 1000))), redFrom);
      setLit(kmhTicks, st.k, Math.round(N * Math.min(1, kmh / SPEED_MAX)), N + 1);
      setText(rpmText, formatRpm(rpm)); setText(kmhText, String(Math.round(kmh))); setText(gear, gearValue);
    };
  },
  portrait(svg, engine) {
    const s = rpmScale(engine.redline), START = 135, SWEEP = 270, N = 60;
    const g = el('g', {}, svg);
    enginePick(this, g, engine, 250, -14);
    const rpmTicks = arcTicks(g, 250, 250, 232, N, START, SWEEP, 32);
    arcLabels(g, 250, 250, 180, s.values, s.top, START, SWEEP);
    const rpmText = text(g, 250, 150, 'mid', '0'); text(g, 250, 178, 'unit', t('rpmUnit'));
    const kmhText = text(g, 250, 312, 'xxl', '0'); text(g, 250, 352, 'unit', t('kmhUnit'));
    const gear = gearBadge(g, 250, 462, 110, 76);
    this.note = text(g, 250, 560, 'note' + (this.noteVisible ? '' : ' waiting'), t('volumeNote'));
    const st = { r: {} }, redFrom = Math.floor(N * engine.redline * 0.92 / (s.top * 1000));
    return (rpm, kmh, gearValue) => {
      setLit(rpmTicks, st.r, Math.round(N * Math.min(1, rpm / (s.top * 1000))), redFrom);
      setText(rpmText, formatRpm(rpm)); setText(kmhText, String(Math.round(kmh))); setText(gear, gearValue);
    };
  }
};
const VIEWBOX = { a: '0 -40 1000 460', portrait: '0 -50 500 630' };

export class Cluster {
  constructor(root, onEngineClick) { this.root = root; this.onEngineClick = onEngineClick; this.engine = null; this.noteVisible = false; this.layout = null; this.draw = null; }
  pickLayout() { const w = window.innerWidth, h = window.innerHeight; return h > w * 1.1 ? 'portrait' : 'a'; }
  refit() { if (this.engine && this.pickLayout() !== this.layout) this.build(); }
  setEngine(engine) { this.engine = engine; this.build(); }
  build() {
    if (!this.engine) return;
    this.root.innerHTML = ''; this.layout = this.pickLayout();
    const svg = el('svg', { viewBox: VIEWBOX[this.layout], class: 'cluster-svg', 'aria-hidden': 'true' }, this.root);
    this.draw = builders[this.layout].call(this, svg, this.engine);
  }
  setNoteVisible(on) { this.noteVisible = on; if (this.note) this.note.setAttribute('class', 'note' + (on ? '' : ' waiting')); }
  render(rpm, kmh, gear) { if (this.draw) this.draw(rpm, kmh, gear); }
}
