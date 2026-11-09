import './style.css';
import { createStage } from './scene.js';
import { loadFont, prewarm } from './hopper.js';
import { World } from './world.js';
import { Sound, Speech } from './audio.js';
import { Lockdown } from './lockdown.js';
import { ALPHABET, DIGITS, classifyKey, parseLetterSet, lower } from './alphabet.js';
import { renderTitle, KeyboardHint, StarCounter } from './ui.js';
import { FreeMode } from './modes/free.js';
import { PracticeMode } from './modes/practice.js';
import { KeyFilter } from './keyfilter.js';

const $ = (id) => document.getElementById(id);
const menu = $('menu');
const paused = $('paused');
const optSound = $('opt-sound');
const optSpeech = $('opt-speech');
const optLetters = $('opt-letters');
const buttons = [...document.querySelectorAll('.mode-btn')];

renderTitle($('title'), 'Bokstavhopp');

// ---------- Settings (remembered per browser) ----------
const SETTINGS_KEY = 'bokstavhopp-settings';
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (typeof saved.sound === 'boolean') optSound.checked = saved.sound;
  if (typeof saved.speech === 'boolean') optSpeech.checked = saved.speech;
  if (typeof saved.letters === 'string') optLetters.value = saved.letters;
} catch {}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      sound: optSound.checked, speech: optSpeech.checked, letters: optLetters.value,
    }));
  } catch {}
}
[optSound, optSpeech, optLetters].forEach((el) => el.addEventListener('change', saveSettings));

// ---------- Core systems ----------
const stage = createStage($('scene'));
const sound = new Sound();
const speech = new Speech();
const world = new World(stage, sound);
const hint = new KeyboardHint($('keyboard-hint'));
const stars = new StarCounter($('hud'), $('stars'), $('trophies'));

const modes = {
  free: new FreeMode({ world, sound, speech }),
  practice: new PracticeMode({ world, sound, speech, hint, stars }),
};
let mode = null;

const speechNote = $('speech-note');
function updateSpeechNote() {
  if (speech.available) {
    speechNote.hidden = true;
  } else {
    speechNote.hidden = false;
    speechNote.textContent =
      'Fant ingen norsk stemme i nettleseren, så bokstavene blir ikke lest opp. ' +
      'Microsoft Edge har norske stemmer innebygd.';
  }
}
speech.onVoices = updateSpeechNote;
setTimeout(updateSpeechNote, 1500);

const lockdown = new Lockdown({
  onExit: () => stopGame(),
  onLost: () => { if (mode) paused.hidden = false; },
  onRegained: () => { paused.hidden = true; },
});
if (!lockdown.supportsKeyboardLock) {
  const n = $('lock-note');
  n.hidden = false;
  n.textContent =
    'Denne nettleseren kan ikke låse alle taster (f.eks. Esc og Alt+Tab). ' +
    'Bruk Chrome eller Edge for best resultat.';
}

// ---------- Start / stop ----------
async function startGame(name) {
  sound.init();
  sound.enabled = optSound.checked;
  speech.enabled = optSpeech.checked;
  if (name === 'practice') modes.practice.setLetters(parseLetterSet(optLetters.value));
  saveSettings();

  menu.hidden = true;
  document.activeElement?.blur?.();
  document.body.classList.add('playing');
  world.clear();
  mode = modes[name];
  mode.start();
  await lockdown.enter();
  paused.hidden = lockdown.isFullscreen;
}

async function stopGame() {
  if (!mode) return;
  mode.stop();
  mode = null;
  speech.stop();
  world.clear();
  paused.hidden = true;
  document.body.classList.remove('playing');
  await lockdown.leave();
  menu.hidden = false;
  buttons[0].focus();
}

buttons.forEach((b) => b.addEventListener('click', () => startGame(b.dataset.mode)));
paused.addEventListener('click', () => lockdown.goFullscreen());
// Clicking anywhere while paused also brings fullscreen back.
window.addEventListener('pointerdown', () => {
  if (mode && !lockdown.isFullscreen) lockdown.goFullscreen();
});

// ---------- Keyboard ----------
const keyFilter = new KeyFilter();
window.addEventListener('keydown', (e) => {
  if (!mode) return; // In the menu the keyboard works normally.
  e.preventDefault();
  e.stopPropagation();
  if (lockdown.checkExitCombo(e)) return;
  if (!keyFilter.down(e)) return; // holding a key down should not spawn a flood
  mode.onKey(classifyKey(e));
}, { capture: true });

window.addEventListener('keyup', (e) => {
  keyFilter.up(e);
  if (mode) { e.preventDefault(); e.stopPropagation(); }
}, { capture: true });
window.addEventListener('keypress', (e) => {
  if (mode) { e.preventDefault(); e.stopPropagation(); }
}, { capture: true });
// Keyups can get lost when the window loses focus – start fresh.
window.addEventListener('blur', () => keyFilter.reset());
// No context menu, no pinch/ctrl-zoom, no dragging while playing.
window.addEventListener('contextmenu', (e) => { if (mode) e.preventDefault(); });
window.addEventListener('wheel', (e) => { if (mode || e.ctrlKey) e.preventDefault(); }, { passive: false });
window.addEventListener('dragstart', (e) => e.preventDefault());

// ---------- Menu attract mode: letters hop around behind the menu ----------
let attractIn = 0.5;
function attract(dt) {
  attractIn -= dt;
  if (attractIn > 0) return;
  attractIn = 1.3 + Math.random() * 0.8;
  const u = ALPHABET[(Math.random() * ALPHABET.length) | 0];
  const lim = world.halfWidth - 2;
  world.spawnPair(u, lower(u), { x: (Math.random() * 2 - 1) * lim, scale: 2, life: 2.5, quiet: true });
  world.limit(12);
}

// ---------- Loop ----------
let lastTime = null;
function frame(time) {
  const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 1 / 20);
  lastTime = time;
  if (mode) mode.update(dt);
  else if (fontReady) attract(dt);
  world.update(dt);
  stage.update(dt);
  stage.renderer.render(stage.scene, stage.camera);
}

let fontReady = false;
loadFont(`${import.meta.env.BASE_URL}fonts/andika-bold.typeface.json`)
  .then(() => {
    prewarm([...ALPHABET, ...ALPHABET.toLocaleLowerCase('nb'), ...DIGITS]);
    fontReady = true;
    buttons.forEach((b) => (b.disabled = false));
    $('loading').hidden = true;
    buttons[0].focus();
  })
  .catch((err) => {
    console.error(err);
    $('loading').textContent = 'Kunne ikke laste skrifttypen. Last siden på nytt.';
  });

stage.renderer.setAnimationLoop(frame);

// Handy for poking at the game from the dev console.
if (import.meta.env.DEV) window.__bokstavhopp = { modes, world, lockdown };
