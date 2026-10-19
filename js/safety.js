// Safety gate. Bump SAFETY_VERSION whenever the consent text changes meaningfully.
export const SAFETY_VERSION = 'v2026-10';
const KEY = 'ge.safety.' + SAFETY_VERSION;

export function needsSafety() { try { return localStorage.getItem(KEY) !== '1'; } catch (e) { return true; } }
export function acceptSafety() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
