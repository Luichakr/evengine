// The brand mark is the two letters "EV" (replaces the ghost). markShapes() draws it centred in a
// 100x110 box; brandMark() is the small inline version for the top bar.
export function markShapes() {
  return '<text x="50" y="58" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="Titillium Web, sans-serif" font-weight="800" font-size="52" letter-spacing="2" fill="#ffffff">EV</text>';
}
export function brandMark() {
  return '<svg viewBox="0 0 100 110" width="22" height="24" aria-hidden="true">' + markShapes() + '</svg>';
}
