// Visual FX driven each frame. Toggles classes on <html>/.cluster and the --rev CSS variable;
// the rest is CSS. fx-lite drops the heavy background work on slow car browsers.
const root = document.documentElement;

export const fx = (() => {
  let rev = -1, moving = false, limit = false, slow = 0, frames = 0, lite = /[?&]lite\b/.test(location.search);
  const cluster = () => document.getElementById('cluster');
  const scene = () => document.getElementById('scene');
  if (lite) root.classList.add('fx-lite');

  return {
    event(kind) {
      if (kind === 'start' || kind === 'switch') {
        const c = 'fx-' + kind; root.classList.remove(c); void root.offsetWidth; root.classList.add(c);
        setTimeout(() => root.classList.remove(c), 900);
      } else if (kind === 'upshift' || kind === 'downshift') {
        const cl = cluster(); if (cl) { cl.classList.remove('shift'); void cl.offsetWidth; cl.classList.add('shift'); setTimeout(() => cl.classList.remove('shift'), 520); }
      }
    },
    // level = rpm/redline (0..1), kmh, event, running
    frame(level, kmh, event, running) {
      if (event) this.event(event);
      const r = Math.round(level * 50) / 50;
      if (r !== rev) { rev = r; const cl = cluster(), sc = scene(); if (cl) cl.style.setProperty('--rev', r); if (sc) sc.style.setProperty('--rev', r); root.style.setProperty('--rev', r); }
      const nowMoving = kmh > 8 ? true : (kmh < 3 ? false : moving);
      if (nowMoving !== moving) { moving = nowMoving; root.classList.toggle('moving', moving); }
      const nowLimit = running && level > 0.965;
      if (nowLimit !== limit) { limit = nowLimit; root.classList.toggle('limit', limit); }
      // auto fx-lite if we drop below ~35fps for a stretch
      if (!lite) { frames++; if (frames <= 180) { /* sampled in app loop via markSlow */ } }
    },
    markSlow(isSlow) { if (lite) return; if (isSlow) slow++; if (slow > 120) { lite = true; root.classList.add('fx-lite'); } }
  };
})();
