// -----------------------------------------------------------------------------
// The feed of a regional Crous, on its real answers (Toulouse and Rennes,
// 2026-10-29), and the text helpers.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionOf } from '../src/config.js';
import { addDays, parisDate, parisMinutes } from '../src/dates.js';
import { reasonOf, servesOn, slotText, vegetarianDishes } from '../src/devices.js';
import {
  CROUS_KEYS,
  feedUrl,
  parseBody,
  parseFeed,
  parseMeal,
  readFeed,
  sectionName,
} from '../src/sources.js';
import { hasWord, tidy, wordsOf } from '../src/text.js';
import { fixtureJson, paris } from './helpers/world.js';

const TODAY = '2026-10-29';
const toulouse = () => parseFeed(fixtureJson('toulouse.json'), TODAY);

test('the feed URL of a Crous: plain HTTP, the folder name twice', () => {
  assert.equal(
    feedUrl('aix.marseille'),
    'http://webservices-v2.crous-mobile.fr/feed/aix.marseille/externe/crous-aix.marseille.min.json',
  );
  assert.equal(CROUS_KEYS.length, 26);
});

test('Toulouse: every restaurant, its position, lunch and dinner by section', () => {
  const restaurants = toulouse();
  assert.equal(restaurants.size, 44);
  const arsenal = restaurants.get('167');
  assert.equal(arsenal.name, "Resto U' Arsenal");
  assert.equal(arsenal.lat, 43.605629);
  const day = arsenal.days.get(TODAY);
  assert.deepEqual(day.lunch.sections, [
    {
      name: 'Plat',
      dishes: [
        'Steak de poulet à la moutarde',
        'Maquereau ou dos de colin fondue de tomate',
        'Tartine de courgette, chèvre & miel',
        'Riz pilaf',
        'Haricots plats persillés',
      ],
    },
    {
      name: 'Pâtes / pizzas',
      dishes: ['Pizza margarita', 'Pizza merguez', 'Pâtes bio à l’orientale'],
    },
  ]);
  // "menu non communiqué": neither a menu nor a closure.
  assert.deepEqual(day.dinner, { status: 'unknown' });
  assert.equal(servesOn(arsenal, TODAY), true);
  // The closures of the holidays and of 11 November.
  assert.equal(arsenal.days.get('2026-11-01').lunch.status, 'closed');
  assert.equal(reasonOf(arsenal, '2026-11-11', 'lunch'), 'closed');
  // Between two days published: not served; after the last one: not published.
  assert.equal(reasonOf(arsenal, '2026-11-05', 'lunch'), 'notServed');
  assert.equal(reasonOf(arsenal, '2026-11-12', 'lunch'), 'notPublished');
});

test('a closure keeps the notice of the Crous, in capitals sections are tidied', () => {
  const esplanade = toulouse().get('804');
  const closed = esplanade.days.get(TODAY).lunch;
  assert.equal(closed.status, 'closed');
  assert.match(closed.note, /^Structure fermée du /);
  assert.equal(servesOn(esplanade, TODAY), false);
  assert.equal(slotText(esplanade, TODAY, 'lunch', 'fr'), 'Fermé');
  // "ENTREES", "PLATS": sentence case; empty dishes dropped.
  const insa = toulouse().get('662').days.get('2026-11-02').lunch;
  assert.deepEqual(
    insa.sections.map((s) => s.name),
    ['Entrees', 'Plats', 'Desserts'],
  );
  assert.ok(insa.sections.every((s) => s.dishes.every(Boolean)));
});

test('vegetarian dishes: marked by the dish or by its section, not a "végétal" yoghurt', () => {
  const insa = toulouse().get('662').days.get('2026-11-02').lunch;
  assert.deepEqual(vegetarianDishes(insa), ['Veg Galette épinard brebis']);
  const meal = parseMeal({
    name: 'midi',
    foodcategory: [
      { name: 'Plat végétarien', dishes: [{ name: 'Dahl de lentilles' }] },
      { name: 'Viande / poisson / végé', dishes: [{ name: 'Poulet rôti' }] },
      { name: 'Desserts', dishes: [{ name: 'Yaourt végétal' }, { name: 'Brownie vegan' }] },
    ],
  });
  assert.deepEqual(vegetarianDishes(meal), ['Dahl de lentilles', 'Brownie vegan']);
});

test('two lunch blocks of a cafeteria the same day are merged', () => {
  const cafet = toulouse().get('672').days.get(TODAY).lunch;
  assert.equal(cafet.status, 'menu');
  assert.ok(cafet.sections.length >= 2);
});

test('Rennes: the holidays, numbered sections, restaurants without any menu', () => {
  const restaurants = parseFeed(fixtureJson('rennes.json'), TODAY);
  assert.equal(restaurants.size, 39);
  assert.equal(restaurants.get('437').days.get(TODAY).lunch.status, 'closed');
  const fougeres = restaurants.get('442').days.get(TODAY).lunch;
  assert.deepEqual(
    fougeres.sections.map((s) => s.name),
    ["Hors d'oeuvres", 'Desserts', 'Plats chauds'],
  );
  assert.equal(restaurants.get('439').days.size, 0);
  assert.equal(reasonOf(restaurants.get('439'), TODAY, 'lunch'), 'notPublished');
});

test('past days are dropped; notices, breakfasts and empty meals are not menus', () => {
  const restaurants = parseFeed(fixtureJson('toulouse.json'), '2026-11-02');
  assert.equal(restaurants.get('167').days.has(TODAY), false);
  // Opening hours and a notice only: open, menu not given.
  assert.deepEqual(
    parseMeal({
      name: 'midi',
      foodcategory: [
        { name: 'HORAIRES', dishes: [{ name: '11h30 - 13h30' }] },
        { name: 'Plats', dishes: [{ name: '* : certains produits ne sont pas disponibles' }] },
      ],
    }),
    { status: 'unknown' },
  );
  assert.equal(parseMeal({ name: 'midi', foodcategory: [{ name: 'Plats', dishes: [] }] }), null);
  const feed = parseFeed(
    {
      restaurants: [
        {
          id: 1,
          title: 'Cafet',
          menus: [
            {
              date: '2026-11-03',
              meal: [
                {
                  name: 'matin',
                  foodcategory: [{ name: 'Petit déjeuner', dishes: [{ name: 'Croissant' }] }],
                },
              ],
            },
          ],
        },
        { id: 'bad id', title: 'X' },
        { id: 2 },
      ],
    },
    TODAY,
  );
  assert.deepEqual([...feed.keys()], ['1']);
  assert.equal(feed.get('1').days.size, 0);
});

test('a body with raw line breaks inside strings still parses; garbage says which host', () => {
  const body = Buffer.from('{"restaurants":[{"id":1,"title":"Resto\nU","menus":[]}]}');
  assert.equal(parseFeed(parseBody(body, feedUrl('lyon')), TODAY).get('1').name, 'Resto U');
  assert.throws(
    () => parseBody(Buffer.from('<html>'), feedUrl('lyon')),
    /crous-mobile\.fr: invalid JSON/,
  );
  assert.throws(() => parseFeed({}, TODAY), /no restaurant list/);
});

test('readFeed: conditional request with the ETag, 304 kept, errors with the host only', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    if (init.headers['if-none-match'] === '"v1"') {
      return new Response(null, { status: 304 });
    }
    return new Response(JSON.stringify(fixtureJson('rennes.json')), {
      status: 200,
      headers: { etag: '"v1"' },
    });
  };
  const first = await readFeed('rennes', fetch, TODAY);
  assert.equal(first.etag, '"v1"');
  assert.equal(first.restaurants.size, 39);
  assert.deepEqual(await readFeed('rennes', fetch, TODAY, '"v1"'), {
    notModified: true,
    etag: '"v1"',
  });
  assert.match(calls[0].headers['user-agent'], /gladys-crous/);
  await assert.rejects(
    readFeed('rennes', async () => new Response('down', { status: 503 }), TODAY),
    /^Error: webservices-v2\.crous-mobile\.fr: HTTP 503$/,
  );
  await assert.rejects(readFeed('atlantis', fetch, TODAY), /unknown Crous/);
});

test('text helpers: sections, tidy, watched words', () => {
  assert.equal(sectionName('2 - Plats chauds'), 'Plats chauds');
  assert.equal(sectionName('  Desserts  '), 'Desserts');
  assert.equal(tidy('  '), null);
  assert.deepEqual(wordsOf('Frites, pizza ;; x'), ['frites', 'pizza']);
  assert.equal(hasWord('Pizza merguez', 'pizza'), true);
  assert.equal(hasWord('Chorizo', 'riz'), false);
});

test('home position: dot or comma decimals, nonsense refused', () => {
  assert.deepEqual(positionOf('43.6045, 1.4440'), { lat: 43.6045, lon: 1.444 });
  assert.deepEqual(positionOf('43,6045; 1,4440'), { lat: 43.6045, lon: 1.444 });
  assert.deepEqual(positionOf('43.6 -1.2'), { lat: 43.6, lon: -1.2 });
  assert.equal(positionOf(''), null);
  assert.equal(positionOf('Toulouse'), null);
  assert.equal(positionOf('95, 1'), null);
});

test('dates: the day in Paris, whatever the clock of the host', () => {
  assert.equal(parisDate(paris('2026-10-29', '23:30')), '2026-10-29');
  assert.equal(parisMinutes(paris('2026-10-29', '07:15')), 435);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});
