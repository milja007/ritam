/**
 * WCAG 2.x kontrast boja. Čista logika — služi testovima da paleta
 * ostane čitljiva kad se boje mijenjaju.
 */

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

/** "#RRGGBB" → [r, g, b] u rasponu 0–255, ili `null` za neispravan unos. */
export function parseHex(hex: string): [number, number, number] | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relativna luminancija (0 = crna, 1 = bijela). `null` za neispravnu boju. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Omjer kontrasta 1–21. `null` ako je bilo koja boja neispravna. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
