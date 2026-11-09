// Stops a held-down key from flooding the screen.
//
// `e.repeat` alone is not enough: on Linux/X11 (incl. WSLg), remote desktop and
// some keyboards, auto-repeat arrives as fake keyup+keydown pairs with
// repeat=false. So we also track which keys are physically down, treat a keydown
// that comes right after its own keyup as a repeat, and add a per-key cooldown.

const FAKE_REPEAT_GAP_MS = 90; // keydown this soon after keyup = auto-repeat, not a new press
const STALE_HELD_MS = 1200; // if we never saw a keyup, forget the key after this long
const COOLDOWN_MS = 120; // minimum time between two accepted presses of the same key (still allows "TT" in KATT)

export class KeyFilter {
  constructor() {
    this.reset();
  }

  reset() {
    this.held = new Map(); // code -> last time we saw it go down / repeat
    this.lastUp = new Map();
    this.lastAccepted = new Map();
  }

  /** @returns {boolean} true if this keydown is a new, deliberate press */
  down(e) {
    const code = e.code || e.key;
    const now = performance.now();
    const seen = this.held.get(code);
    this.held.set(code, now);

    if (e.repeat) return false;
    if (seen !== undefined && now - seen < STALE_HELD_MS) return false;
    const up = this.lastUp.get(code);
    if (up !== undefined && now - up < FAKE_REPEAT_GAP_MS) return false;
    const last = this.lastAccepted.get(code);
    if (last !== undefined && now - last < COOLDOWN_MS) return false;

    this.lastAccepted.set(code, now);
    return true;
  }

  up(e) {
    const code = e.code || e.key;
    this.held.delete(code);
    this.lastUp.set(code, performance.now());
  }
}
