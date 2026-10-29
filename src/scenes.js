// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// - menu_of_day: today's or tomorrow's menu of the watched restaurants (all
//   of them, or the one picked) as a sentence ready for a message or a
//   speaker ("Resto U' Arsenal, demain. Midi : Plat : …"), plus a number for
//   a "Continue only if" step.
//
// A scene action does not receive the user's language: the sentence follows
// the `language` of the configuration. Outputs are numbers, never booleans:
// the core's "Continue only if" compares with ===. The core applies no
// `default` to an action field: an empty day is today, an empty meal is
// lunch and dinner.
// -----------------------------------------------------------------------------

import { SLOTS, servesOn } from './devices.js';
import { TEXT, say } from './messages.js';

export class SceneError extends Error {}

const chosenIds = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

export const SCENE_ACTIONS = {
  async menu_of_day(service, { fields }) {
    const language = service.config.language;
    // Asked right at start: the first reading, not "not published".
    await service.firstReading();
    const watched = service.watched();
    if (watched.length === 0) {
      throw new SceneError(say(TEXT, language, 'noRestaurant'));
    }
    const asked = chosenIds(fields?.restaurant);
    const chosen = watched.filter((entry) => asked.includes(entry.deviceId));
    if (asked.length > 0 && chosen.length === 0) {
      throw new SceneError(say(TEXT, language, 'gone'));
    }
    const day = fields?.day === 'tomorrow' ? 'tomorrow' : 'today';
    const slots = SLOTS.includes(fields?.meal) ? [fields.meal] : SLOTS;
    const entries = chosen.length > 0 ? chosen : watched;
    let served = 0;
    for (const entry of entries) {
      const { found, date } = service.dayOf(entry.deviceId, day);
      const restaurant = found?.restaurant;
      if (
        restaurant &&
        (slots.length === SLOTS.length
          ? servesOn(restaurant, date)
          : restaurant.days.get(date)?.[slots[0]]?.status === 'menu')
      ) {
        served += 1;
      }
    }
    return {
      sentence: entries.map((entry) => service.sentence(entry, day, language, slots)).join(' '),
      has_menu: served > 0 ? 1 : 0,
    };
  },
};
