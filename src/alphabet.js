// The Norwegian alphabet and helpers for turning key presses into letters.

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ';
export const DIGITS = '0123456789';

// Speech: Norwegian voices read a lone capital letter by its letter name
// ("D" -> "de", "H" -> "hå"), which is more reliable than phonetic spellings
// ("de"/"ge" would be read as the words "di"/"je"). Only exceptions live here.
export const LETTER_NAMES = {
  W: 'dobbelt-ve',
};

export const upper = (ch) => ch.toLocaleUpperCase('nb');
export const lower = (ch) => ch.toLocaleLowerCase('nb');

/** Index used for colour and pitch, so each letter always looks and sounds the same. */
export function charIndex(ch) {
  const u = upper(ch);
  const i = ALPHABET.indexOf(u);
  if (i >= 0) return i;
  const d = DIGITS.indexOf(u);
  return d >= 0 ? d * 3 : 0;
}

/** Hue in [0,1). Letters walk around the colour wheel in alphabet order. */
export function charHue(ch) {
  const u = upper(ch);
  if (DIGITS.includes(u)) return ((DIGITS.indexOf(u) * 0.37) % 1);
  return charIndex(u) / ALPHABET.length;
}

export function cssColor(ch) {
  return `hsl(${Math.round(charHue(ch) * 360)} 80% 52%)`;
}

/**
 * Classify a keydown event.
 * @returns {{type:'letter', upper:string, lower:string} | {type:'digit', char:string} | {type:'other', key:string, code:string}}
 */
export function classifyKey(e) {
  const k = e.key;
  if (k && k.length === 1) {
    const u = upper(k);
    if (ALPHABET.includes(u)) return { type: 'letter', upper: u, lower: lower(u) };
    if (DIGITS.includes(k)) return { type: 'digit', char: k };
  }
  // When modifiers are held some layouts report odd e.key values: fall back to the physical key.
  const m = /^Key([A-Z])$/.exec(e.code || '');
  if (m && (e.ctrlKey || e.altKey || e.metaKey)) return { type: 'letter', upper: m[1], lower: lower(m[1]) };
  const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
  if (d) return { type: 'digit', char: d[1] };
  return { type: 'other', key: k, code: e.code };
}

/** Parse the "practice only these letters" setting. */
export function parseLetterSet(text) {
  const set = [];
  for (const ch of upper(text || '')) {
    if (ALPHABET.includes(ch) && !set.includes(ch)) set.push(ch);
  }
  return set.length ? set : ALPHABET.split('');
}
