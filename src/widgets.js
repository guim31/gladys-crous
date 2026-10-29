// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+).
//
// - menus: today's and tomorrow's menu of the watched restaurants, one row
//   each in a `card-list` ("Resto U' Arsenal · Aujourd'hui" / "Steak de
//   poulet, Riz pilaf…", a "Veggie" badge when a vegetarian dish is marked);
//   tapping a row opens the whole day, section by section. Tomorrow and the
//   dinner can be hidden.
//
// Budget of the core: 8 components, 2 texts; a `list` holds 8 rows: 4
// restaurants with tomorrow, 8 without.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { SLOTS, slotText, vegetarianDishes } from './devices.js';
import { TEXT, say } from './messages.js';
import { parisMinutes } from './dates.js';
import { WIDGET_KEY } from './service.js';
import { clip, fold } from './text.js';

export const MAX_ROWS = 8;

/** The detail panel: one block per meal served, one line per section. */
function details(restaurant, date, language, slots) {
  const colon = language === 'fr' ? ' : ' : ': ';
  const blocks = slots
    .filter((slot, index) => index === 0 || restaurant.days.get(date)?.[slot]?.status === 'menu')
    .map((slot) => {
      const meal = restaurant.days.get(date)?.[slot];
      const body =
        meal?.status === 'menu'
          ? meal.sections.map((s) =>
              s.name ? `${s.name}${colon}${s.dishes.join(', ')}` : s.dishes.join(', '),
            )
          : [slotText(restaurant, date, slot, language)];
      if (meal?.status === 'closed' && language === 'fr') {
        body.push(meal.note);
      }
      return [`■ ${say(TEXT, language, slot)}`, ...body].join('\n');
    });
  return clip(blocks.join('\n\n'), 2000);
}

/**
 * The subtitle: the main courses ("Plat", "Plats chauds"…) of the first meal
 * served, else its first section, or why there is none.
 */
function headline(restaurant, date, language, slots) {
  for (const slot of slots) {
    const meal = restaurant.days.get(date)?.[slot];
    if (meal?.status === 'menu') {
      const main = meal.sections.find((s) => /^plat/.test(fold(s.name))) ?? meal.sections[0];
      return main.dishes.join(', ');
    }
  }
  return slotText(restaurant, date, slots[0], language);
}

function row(service, entry, day, language, slots) {
  const { found, date } = service.dayOf(entry.deviceId, day);
  const restaurant = found?.restaurant ?? { days: new Map() };
  // The day label is never cut: two rows of a long name stay distinct.
  const dayLabel = say(TEXT, language, day);
  const title = `${clip(entry.name, 60 - dayLabel.length - 3)} · ${dayLabel}`;
  const subtitle = clip(headline(restaurant, date, language, slots), 60);
  if (!slots.some((slot) => restaurant.days.get(date)?.[slot]?.status === 'menu')) {
    const meal = restaurant.days.get(date)?.lunch;
    return meal?.status === 'closed'
      ? { title, subtitle, description: details(restaurant, date, language, slots) }
      : { title, subtitle };
  }
  const vegetarian = slots.some(
    (slot) => vegetarianDishes(restaurant.days.get(date)?.[slot]).length > 0,
  );
  return {
    title,
    subtitle,
    ...(vegetarian
      ? { badge: { text: say(TEXT, language, 'vegetarianBadge'), color: WIDGET_COLORS.SUCCESS } }
      : {}),
    description: details(restaurant, date, language, slots),
  };
}

async function menusContent(service, { settings, language }) {
  await service.firstReading();
  const watched = service.watched();
  const chosen = Array.isArray(settings?.restaurants) ? settings.restaurants.map(String) : [];
  let days = settings?.show_tomorrow === false ? ['today'] : ['today', 'tomorrow'];
  const slots = settings?.show_dinner === false ? ['lunch'] : SLOTS;
  const entries =
    chosen.length > 0
      ? chosen.map((id) => watched.find((entry) => entry.deviceId === id)).filter(Boolean)
      : watched;
  // Half an hour, but never past midnight (Paris): "today" changes then.
  const toMidnight = (1440 - parisMinutes(service.now())) * 60;
  const ttl = Math.max(60, Math.min(1800, toMidnight + 60));
  if (entries.length === 0) {
    const key = chosen.length > 0 ? 'gone' : 'pickRestaurant';
    return { ttl_seconds: ttl, components: [{ type: 'text', text: say(TEXT, language, key) }] };
  }
  // Too many rows: today only for every restaurant, before leaving some out.
  if (entries.length * days.length > MAX_ROWS) {
    days = ['today'];
  }
  const shown = entries.slice(0, MAX_ROWS);
  const items = shown.flatMap((entry) =>
    days.map((day) => row(service, entry, day, language, slots)),
  );
  const hidden = entries.length - shown.length;
  return {
    ttl_seconds: ttl,
    components: [
      { type: 'card-list', display: 'list', items },
      ...(hidden > 0
        ? [
            {
              type: 'text',
              variant: 'caption',
              text: say(TEXT, language, 'hidden', { count: hidden }),
            },
          ]
        : []),
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get: menusContent },
};
