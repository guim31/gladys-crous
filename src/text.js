// -----------------------------------------------------------------------------
// Text helpers: cleaning the dish names the restaurants publish, building ids,
// shortening, and the "watched word" match of the scene trigger.
// -----------------------------------------------------------------------------

/** Shortens a text to `max` characters, with an ellipsis. */
export function clip(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** A piece of an external id: letters, digits, "_" and "-" only. */
export const slug = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Lower case without accents, for comparisons. */
export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .toLowerCase();

/**
 * A dish name or a section as the restaurant wrote it, made readable: HTML tags and
 * repeated blanks removed, the "œ" lost by an export ("b?uf") restored, and
 * a text in capitals ("SAUTE VEAU MARENGO") put in sentence case. Null when
 * nothing is left.
 */
export function tidy(value) {
  if (value === null || value === undefined) {
    return null;
  }
  let text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // "b?uf", "c?ur", "s?ur", "?uf": an œ; "d?un", "l?huile": an apostrophe.
    .replace(/(?<=^|[\s(]|[bcmnsvBCMNSV])\?(?=u)/gu, 'œ')
    .replace(/(?<=\p{L})\?(?=\p{L})/gu, '’')
    .replace(/\s+/g, ' ')
    .trim();
  const letters = text.match(/\p{L}/gu) ?? [];
  const capitals = text.match(/\p{Lu}/gu) ?? [];
  if (letters.length > 3 && capitals.length / letters.length > 0.6) {
    text = text.toLowerCase();
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text === '' ? null : text;
}

/** The watched words of the configuration: "Frites, pizza" → ['frites', 'pizza']. */
export function wordsOf(value) {
  const words = String(value ?? '')
    .split(/[,;\n]+/)
    .map((word) => word.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, 20);
}

/**
 * Does a dish contain a word? Accents and case aside, at the start of a
 * word: "frite" finds "Frites au four", "pâte" finds "Pâtes", but "riz" does
 * not find "Chorizo".
 */
export function hasWord(dish, word) {
  const target = fold(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${target}`).test(fold(dish));
}
