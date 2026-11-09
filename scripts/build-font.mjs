// Converts the Andika Bold TTF into a small three.js typeface JSON containing
// only the glyphs the game needs. Run with: npm run font
// (Same conversion as three's TTFLoader, but offline and subsetted.)
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ' +
  'abcdefghijklmnopqrstuvwxyzæøå' +
  '0123456789';

const src = new URL('../public/fonts/Andika-Bold.ttf', import.meta.url);
const out = new URL('../public/fonts/andika-bold.typeface.json', import.meta.url);

const buf = readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const r = Math.round;

const glyphs = {};
for (const ch of CHARS) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) throw new Error(`Missing glyph: ${ch}`);
  let o = '';
  for (const c of glyph.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase();
    o += type + ' ';
    if (c.x !== undefined) o += r(c.x * scale) + ' ' + r(c.y * scale) + ' ';
    if (c.x1 !== undefined) o += r(c.x1 * scale) + ' ' + r(c.y1 * scale) + ' ';
    if (c.x2 !== undefined) o += r(c.x2 * scale) + ' ' + r(c.y2 * scale) + ' ';
  }
  glyphs[ch] = {
    ha: r(glyph.advanceWidth * scale),
    x_min: r((glyph.xMin ?? 0) * scale),
    x_max: r((glyph.xMax ?? 0) * scale),
    o,
  };
}

const json = {
  glyphs,
  familyName: font.getEnglishName('fullName'),
  ascender: r(font.ascender * scale),
  descender: r(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: {
    xMin: font.tables.head.xMin,
    xMax: font.tables.head.xMax,
    yMin: font.tables.head.yMin,
    yMax: font.tables.head.yMax,
  },
  resolution: 1000,
  original_font_information: { copyright: 'Copyright (c) 2004-2022 SIL International. SIL Open Font License 1.1 (see OFL.txt).' },
};
writeFileSync(out, JSON.stringify(json));
console.log(`Wrote ${Object.keys(glyphs).length} glyphs to ${out.pathname}`);
