// The ignition screen's warm-up ring (54 ticks, 270° arc) around the "EV" mark. Returns fill(frac)
// to light ticks clockwise as the engine ignites.
const TICKS = 54, RED_FROM = TICKS - 8, CX = 50, CY = 55, R = 86 / 2;

export function buildIntro(svg) {
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ring.setAttribute('class', 'ring');
  let s = '';
  for (let i = 0; i < TICKS; i++) {
    const a = (135 + 270 * i / (TICKS - 1)) * Math.PI / 180;
    const r1 = R, r2 = R - 6;
    const x1 = (CX + r1 * Math.cos(a)).toFixed(1), y1 = (CY + r1 * Math.sin(a)).toFixed(1);
    const x2 = (CX + r2 * Math.cos(a)).toFixed(1), y2 = (CY + r2 * Math.sin(a)).toFixed(1);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${i >= RED_FROM ? 'red' : ''}"/>`;
  }
  ring.innerHTML = s; svg.appendChild(ring);
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', CX); label.setAttribute('y', CY + 1); label.setAttribute('class', 'ev-mark');
  label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'central');
  label.textContent = 'EV'; svg.appendChild(label);
  const lines = [...ring.querySelectorAll('line')];
  return {
    fill(frac) { const n = Math.round(Math.max(0, Math.min(1, frac)) * TICKS); for (let i = 0; i < TICKS; i++) lines[i].classList.toggle('lit', i < n); }
  };
}
