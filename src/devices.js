// -----------------------------------------------------------------------------
// The Gladys device of a Crous restaurant and its states: one device per
// restaurant (or cafeteria) the user adds from the Discover tab. Features:
//
//   open_today   input/binary  1 when a menu is published for today (lunch
//                              or dinner), 0 when closed, not communicated
//                              or not published
//   lunch        text/text     today's lunch, section by section
//   dinner       text/text     today's dinner (few restaurants serve one)
//   vegetarian   text/text     today's vegetarian dishes, when the
//                              restaurant marks them
//
// A day without a menu says why ("Closed", "Menu not published yet"…): a
// text state is never empty, and never invented. No polling: the
// integration reads the feeds on its own timer (src/service.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
} from '@gladysassistant/integration-sdk';
import { NAMES, TEXT, say } from './messages.js';
import { clip, fold, slug } from './text.js';

export const RESTAURANT_TYPE = 'restaurant';
export const MAX_DEVICE_NAME = 80;
// A text state long enough for a whole meal, short enough for a tile.
export const MAX_STATE = 500;
export const SLOTS = ['lunch', 'dinner'];
export const FEATURE_KEYS = ['open_today', 'lunch', 'dinner', 'vegetarian'];

/** The platform id of a restaurant: "<crous key>-<restaurant id of the feed>". */
export const restaurantPlatformId = (crousKey, restaurantId) =>
  `${slug(crousKey)}-${slug(restaurantId)}`;

// "Veg Galette épinard", "Couscous végétarien", "Bowl veggie", a section
// "Plat végétarien"; not "Yaourt végétal" nor a "Viande / poisson / végé"
// section.
const VEGETARIAN_WORD = /(^|[^a-z])(veg|vege|veggie|vegan|vegetarien|vegetarienne)s?([^a-z]|$)/;
const MEAT_OR_FISH = /viande|poisson|carne/;

/** The dishes of a meal the restaurant marks as vegetarian. */
export function vegetarianDishes(meal) {
  if (meal?.status !== 'menu') {
    return [];
  }
  const found = [];
  for (const section of meal.sections) {
    const name = fold(section.name);
    const wholeSection = VEGETARIAN_WORD.test(name) && !MEAT_OR_FISH.test(name);
    for (const dish of section.dishes) {
      if (wholeSection || VEGETARIAN_WORD.test(fold(dish))) {
        found.push(dish);
      }
    }
  }
  return [...new Set(found)];
}

/** Every dish of a meal, for the watched words. */
export const dishesOf = (meal) =>
  meal?.status === 'menu' ? meal.sections.flatMap((section) => section.dishes) : [];

/** "Plat : Steak, Riz pilaf · Pâtes / pizzas : Pizza margarita". */
export function mealText(meal, language) {
  const colon = language === 'fr' ? ' : ' : ': ';
  return meal.sections
    .map((section) =>
      section.name
        ? `${section.name}${colon}${section.dishes.join(', ')}`
        : section.dishes.join(', '),
    )
    .join(' · ');
}

/**
 * The last day a restaurant published (null without any): a day after it is
 * "not published yet", a day before it without a meal is "not served".
 */
export const lastDateOf = (restaurant) =>
  restaurant?.days?.size ? [...restaurant.days.keys()].sort().at(-1) : null;

/** Why a meal has no dishes on `date`: 'closed', 'unknown', 'notServed' or 'notPublished'. */
export function reasonOf(restaurant, date, slot) {
  const meal = restaurant?.days?.get(date)?.[slot] ?? null;
  if (meal?.status === 'closed' || meal?.status === 'unknown') {
    return meal.status;
  }
  const last = lastDateOf(restaurant);
  return !last || date > last ? 'notPublished' : 'notServed';
}

/** The text of a meal: its dishes, or the reason there are none. */
export function slotText(restaurant, date, slot, language) {
  const meal = restaurant?.days?.get(date)?.[slot] ?? null;
  return meal?.status === 'menu'
    ? mealText(meal, language)
    : say(TEXT, language, reasonOf(restaurant, date, slot));
}

/** Is a menu published on `date` (lunch or dinner)? */
export const servesOn = (restaurant, date) =>
  SLOTS.some((slot) => restaurant?.days?.get(date)?.[slot]?.status === 'menu');

/**
 * The device of a restaurant.
 * @param {object} gladys
 * @param {string} crousKey
 * @param {{ id: string, name: string }} restaurant
 * @param {string} language
 */
export function buildRestaurantDevice(gladys, crousKey, restaurant, language) {
  const ids = gladys.externalIds(RESTAURANT_TYPE, restaurantPlatformId(crousKey, restaurant.id));
  const names = NAMES[language] ?? NAMES.en;
  return {
    name: clip(restaurant.name, MAX_DEVICE_NAME),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'crous', value: crousKey },
      { name: 'restaurant_id', value: restaurant.id },
    ],
    features: FEATURE_KEYS.map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...(key === 'open_today'
        ? { category: C.INPUT, type: T.INPUT.BINARY, min: 0, max: 1 }
        : { category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0 }),
      read_only: true,
      has_feedback: false,
    })),
  };
}

/**
 * The states of a restaurant device on `date` (today in Paris).
 * @param {object} restaurant `{ id, days }`
 */
export function restaurantStates(gladys, crousKey, restaurant, date, language) {
  const ids = gladys.externalIds(RESTAURANT_TYPE, restaurantPlatformId(crousKey, restaurant.id));
  const serves = servesOn(restaurant, date);
  const vegetarian = SLOTS.flatMap((slot) => vegetarianDishes(restaurant.days?.get(date)?.[slot]));
  const text = (key) => {
    if (key === 'vegetarian') {
      if (!serves) {
        return say(TEXT, language, 'none');
      }
      return vegetarian.length
        ? [...new Set(vegetarian)].join(', ')
        : say(TEXT, language, 'noneMarked');
    }
    return slotText(restaurant, date, key, language);
  };
  return FEATURE_KEYS.map((key) =>
    key === 'open_today'
      ? { device_feature_external_id: ids.feature(key), state: serves ? 1 : 0 }
      : { device_feature_external_id: ids.feature(key), text: clip(text(key), MAX_STATE) },
  );
}
