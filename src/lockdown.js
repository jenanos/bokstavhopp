// Fullscreen + keyboard capture, with a secret adult combo to get out.
//
// Uses the Keyboard Lock API (Chrome/Edge) so that system shortcuts such as
// Esc, Alt+Tab, the Windows key, Ctrl+W and Ctrl+T reach the page instead of
// the browser/OS while in fullscreen. A few combos (Ctrl+Alt+Del) can never be
// captured by a web page – see README for kiosk mode.

export const EXIT_WORD = 'SLUTT';
const COMBO_TIMEOUT_MS = 4000;

export class Lockdown {
  constructor({ onExit, onLost, onRegained }) {
    this.onExit = onExit;
    this.onLost = onLost;
    this.onRegained = onRegained;
    this.active = false;
    this.progress = 0;
    this.lastComboKey = 0;
    this.wakeLock = null;

    this.supportsKeyboardLock = !!(navigator.keyboard && navigator.keyboard.lock);

    document.addEventListener('fullscreenchange', () => {
      if (!this.active) return;
      if (document.fullscreenElement) {
        this.onRegained?.(); // keys are (re)locked by goFullscreen()
      } else {
        this.onLost?.();
      }
    });

    // Keep the screen awake and re-take the wake lock when the tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
      if (this.active && document.visibilityState === 'visible') this.#wake();
    });

    this.beforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
  }

  /** Must be called from a user gesture (click / Enter on a button). */
  async enter() {
    this.active = true;
    this.progress = 0;
    window.addEventListener('beforeunload', this.beforeUnload);
    await this.goFullscreen();
    this.#wake();
  }

  async goFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (err) {
      console.warn('Fullscreen failed', err);
    }
    await this.#lockKeys();
  }

  async leave() {
    this.active = false;
    window.removeEventListener('beforeunload', this.beforeUnload);
    try { navigator.keyboard?.unlock?.(); } catch {}
    try { await this.wakeLock?.release(); } catch {}
    this.wakeLock = null;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
  }

  get isFullscreen() {
    return !!document.fullscreenElement;
  }

  /**
   * Feed every keydown here while active. Returns true if the exit combo completed.
   * Combo: hold Ctrl + Shift and type EXIT_WORD in order.
   */
  checkExitCombo(e) {
    if (!this.active) return false;
    if (!(e.ctrlKey && e.shiftKey)) {
      if (!['Control', 'Shift'].includes(e.key)) this.progress = 0;
      return false;
    }
    if (['Control', 'Shift'].includes(e.key)) return false;

    const now = performance.now();
    if (now - this.lastComboKey > COMBO_TIMEOUT_MS) this.progress = 0;
    this.lastComboKey = now;

    const want = EXIT_WORD[this.progress];
    if (matches(e, want)) {
      this.progress++;
    } else {
      this.progress = matches(e, EXIT_WORD[0]) ? 1 : 0;
    }
    if (this.progress >= EXIT_WORD.length) {
      this.progress = 0;
      this.onExit?.();
      return true;
    }
    return false;
  }

  async #lockKeys() {
    if (!this.supportsKeyboardLock) return;
    try {
      // No argument = lock every key, including Escape and OS shortcuts where allowed.
      await navigator.keyboard.lock();
    } catch (err) {
      console.warn('Keyboard lock failed', err);
    }
  }

  async #wake() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch {}
  }
}

function matches(e, letter) {
  if (!letter) return false;
  return (e.key && e.key.toUpperCase() === letter) || e.code === `Key${letter}`;
}
