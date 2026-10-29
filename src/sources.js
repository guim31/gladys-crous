// -----------------------------------------------------------------------------
// The menus of the Crous restaurants: one feed per regional Crous, the one
// the "Crous Mobile" app reads, without key:
//
//   http://webservices-v2.crous-mobile.fr/feed/<crous>/externe/crous-<crous>.min.json
//
// It lists the restaurants (id, name, position, type) and, for each, the
// menus of the days published: `menus[].meal[]` (matin / midi / soir), each
// split into categories of dishes whose names the restaurant chooses
// ("Plat", "ENTREES", "Pâtes / pizzas"…). It is the same content as the
// `menu.xml` feed of the same folder, but already split: no HTML to parse.
// The server answers only in plain HTTP (HTTPS gives 404), sends an ETag,
// and leaves raw line breaks inside strings, which JSON.parse refuses.
//
// Each restaurant becomes:
//
//   { id, name, area, type, lat, lon, days: Map<'YYYY-MM-DD', day> }
//
// and a day holds its lunch and dinner:
//
//   { lunch: meal | null, dinner: meal | null }
//   meal = { status: 'menu', sections: [{ name, dishes }] }
//        | { status: 'closed', note }      "Structure fermée du … au …"
//        | { status: 'unknown' }           "menu non communiqué", or only
//                                          opening hours or prices
//
// A day the restaurant does not publish has no entry: nothing is ever
// invented. Crous keys and restaurant ids are part of the device external
// ids: never rename one. All the feeds were checked live on 2026-10-29.
// -----------------------------------------------------------------------------

import { getBuffer, HttpError, hostOf } from './http.js';
import { fold, tidy } from './text.js';

export const FEED_HOST = 'webservices-v2.crous-mobile.fr';
// Paris weighs 3 MB (menus two months ahead): room for growth.
const MAX_BODY_BYTES = 25e6;

// The 26 regional Crous of the feed index (2026-10-29), key = folder name.
export const CROUS = {
  'aix.marseille': 'Aix-Marseille-Avignon',
  amiens: 'Amiens-Picardie',
  'antilles.guyane': 'Antilles-Guyane',
  bfc: 'Bourgogne-Franche-Comté',
  bordeaux: 'Bordeaux-Aquitaine',
  'clermont.ferrand': 'Clermont Auvergne',
  corte: 'Corse',
  creteil: 'Créteil',
  grenoble: 'Grenoble Alpes',
  lille: 'Lille Nord-Pas-de-Calais',
  limoges: 'Limoges',
  lyon: 'Lyon',
  montpellier: 'Montpellier-Occitanie',
  'nancy.metz': 'Lorraine (Nancy-Metz)',
  nantes: 'Nantes Pays de la Loire',
  nice: 'Nice-Toulon',
  normandie: 'Normandie',
  'orleans.tours': 'Orléans-Tours',
  paris: 'Paris',
  poitiers: 'Poitiers',
  reims: 'Reims',
  rennes: 'Rennes Bretagne',
  reunion: 'La Réunion',
  strasbourg: 'Strasbourg',
  toulouse: 'Toulouse Occitanie',
  versailles: 'Versailles',
};
export const CROUS_KEYS = Object.keys(CROUS);

export const feedUrl = (key) => `http://${FEED_HOST}/feed/${key}/externe/crous-${key}.min.json`;

export const MEALS = { midi: 'lunch', soir: 'dinner' };

// Categories that hold no dish: opening hours, notices, payment, prices.
const NOT_DISHES =
  /^(infos?|informations?|horaires?|divers infos?|paiements?|moyens? de paiement|tarifs?|prix)$/;
// Notices written as a dish: "* : certains produits ne sont pas disponibles…".
const NOTICE = /^\*\s*:/;
const CLOSED = /^structure ferm/;
const UNKNOWN = /^menu non communiqu/;

/**
 * A category name made readable: "2 - Plats chauds" → "Plats chauds",
 * "ENTREES" → "Entrees", blanks collapsed.
 */
export function sectionName(value) {
  const text = tidy(value);
  return text ? text.replace(/^\d+\s*[-.)]\s*/, '') || text : null;
}

/** One meal of the feed (`{ name: 'midi', foodcategory: [...] }`) → a meal, or null. */
export function parseMeal(raw) {
  const categories = Array.isArray(raw?.foodcategory) ? raw.foodcategory : [];
  const sections = [];
  let closed = null;
  let unknown = false;
  for (const category of categories) {
    const name = sectionName(category?.name);
    const dishes = (Array.isArray(category?.dishes) ? category.dishes : [])
      .map((dish) => tidy(dish?.name))
      .filter((dish) => dish && !NOTICE.test(dish));
    const folded = dishes.map(fold);
    if (fold(name) === 'fermeture' || folded.some((d) => CLOSED.test(d))) {
      closed = dishes.find((dish) => CLOSED.test(fold(dish))) ?? name;
      continue;
    }
    if (folded.length > 0 && folded.every((d) => UNKNOWN.test(d))) {
      unknown = true;
      continue;
    }
    if (dishes.length === 0) {
      continue;
    }
    if (name && NOT_DISHES.test(fold(name))) {
      // Opening hours or prices only ("Trio entrée / plat / dessert 20€"):
      // open, but no menu given.
      unknown = true;
      continue;
    }
    sections.push({ name, dishes: [...new Set(dishes)] });
  }
  if (sections.length > 0) {
    return { status: 'menu', sections };
  }
  if (closed) {
    return { status: 'closed', note: closed };
  }
  return unknown ? { status: 'unknown' } : null;
}

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== null ? n : null;
};

/**
 * The feed of a regional Crous → Map restaurant id → restaurant, keeping the
 * days from `today` on (the past ones are never asked).
 */
export function parseFeed(document, today) {
  const list = document?.restaurants;
  if (!Array.isArray(list)) {
    throw new Error('unexpected answer (no restaurant list)');
  }
  const restaurants = new Map();
  for (const raw of list) {
    const id = raw?.id === undefined || raw?.id === null ? '' : String(raw.id).trim();
    const name = tidy(raw?.title);
    if (!/^[\w-]+$/.test(id) || !name || restaurants.has(id)) {
      continue;
    }
    const days = new Map();
    for (const menu of Array.isArray(raw.menus) ? raw.menus : []) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(menu?.date) ? menu.date : null;
      if (!date || date < today) {
        continue;
      }
      const day = days.get(date) ?? { lunch: null, dinner: null };
      for (const meal of Array.isArray(menu.meal) ? menu.meal : []) {
        const slot = MEALS[fold(meal?.name).trim()];
        const parsed = slot ? parseMeal(meal) : null;
        // A cafeteria may publish two "midi" blocks the same day: merged.
        const previous = day[slot];
        if (parsed?.status === 'menu' && previous?.status === 'menu') {
          previous.sections.push(...parsed.sections);
        } else if (parsed && previous?.status !== 'menu') {
          day[slot] = parsed;
        }
      }
      if (day.lunch || day.dinner) {
        days.set(date, day);
      }
    }
    restaurants.set(id, {
      id,
      name,
      area: tidy(raw.area),
      type: tidy(raw.type),
      lat: number(raw.lat),
      lon: number(raw.lon),
      days,
    });
  }
  return restaurants;
}

/** JSON.parse after blanking the control characters the feed leaves inside strings. */
export function parseBody(body, url) {
  try {
    // eslint-disable-next-line no-control-regex
    return JSON.parse(body.toString('utf8').replace(/[\u0000-\u001f]/g, ' '));
  } catch {
    throw new HttpError(`${hostOf(url)}: invalid JSON`);
  }
}

/**
 * Reads the feed of a regional Crous. With the ETag of the last reading, a
 * feed that did not change resolves `{ notModified: true }`.
 */
export async function readFeed(key, fetchImpl, today, etag = null) {
  if (!CROUS[key]) {
    throw new Error(`unknown Crous: ${key}`);
  }
  const url = feedUrl(key);
  const answer = await getBuffer(fetchImpl, url, { maxBytes: MAX_BODY_BYTES, etag });
  if (answer.notModified) {
    return { notModified: true, etag };
  }
  return { restaurants: parseFeed(parseBody(answer.body, url), today), etag: answer.etag };
}
