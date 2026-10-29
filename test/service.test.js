// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the real
// feeds of the Crous of Toulouse and Rennes: discovery (around home too),
// today's states, closures, the scene triggers in their windows, the scene
// action and the widget.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { RETRY_MS } from '../src/service.js';
import {
  action,
  create,
  createWorld,
  discovered,
  featureId,
  lastText,
  paris,
  tickAt,
} from './helpers/world.js';

const ARSENAL = "Resto U' Arsenal";
const RIQUET = 'Brasserie Riquet';
const INSA = "Resto U' Insa";
const ESPLANADE = "Brasserie L'esplanade";

/** The last numeric state published on a feature. */
function lastState(world, device, key) {
  const id = featureId(device, key);
  return world.fake.states.filter((s) => s.device_feature_external_id === id).at(-1)?.state;
}

test('the restaurants of the ticked Crous are offered, no polling, read-only', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'] } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.discoveredDevices.length, 44);
  const device = discovered(world, ARSENAL);
  assert.equal(device.should_poll, false);
  assert.match(device.external_id, /:restaurant:toulouse-167$/);
  assert.deepEqual(
    device.features.map((f) => [f.name, f.category, f.type]),
    [
      ["Ouvert aujourd'hui", 'input', 'binary'],
      ['Menu du midi', 'text', 'text'],
      ['Menu du soir', 'text', 'text'],
      ['Plats végétariens', 'text', 'text'],
    ],
  );
  assert.ok(device.features.every((f) => f.read_only));
  // Only the ticked Crous are read, over plain HTTP (the feed has no HTTPS).
  assert.deepEqual(
    world.network.calls.map((c) => c.url),
    ['http://webservices-v2.crous-mobile.fr/feed/toulouse/externe/crous-toulouse.min.json'],
  );
});

test('around home: nearest first, and only within the distance chosen', async (t) => {
  // Place du Capitole, Toulouse.
  const home = '43.6045, 1.4440';
  const world = await createWorld({ config: { crous: ['toulouse'], home_position: home } });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices.map((d) => d.name);
  assert.equal(names.length, 44);
  assert.deepEqual(names.slice(0, 2), ["Cafet' des Puits Creusés", 'Brasserie Riquet']);
  await world.fake.configUpdated({
    crous: ['toulouse'],
    home_position: home,
    max_distance: '2',
  });
  const near = world.fake.discoveredDevices.map((d) => d.name);
  assert.ok(near.length > 3 && near.length < 15, `${near.length} restaurants within 2 km`);
  assert.ok(near.includes(ARSENAL));
  assert.ok(!near.includes("Resto U' Tarbes"));
  const report = await action(world, 'status');
  assert.match(report.fr, new RegExp(`${near.length} restaurants proposés à moins de 2 km`));
});

test("adding a restaurant publishes today's menu at once, section by section", async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, ARSENAL);
  assert.equal(lastState(world, device, 'open_today'), 1);
  assert.equal(
    lastText(world, device, 'lunch'),
    'Plat : Steak de poulet à la moutarde, Maquereau ou dos de colin fondue de tomate, Tartine de courgette, chèvre & miel, Riz pilaf, Haricots plats persillés · Pâtes / pizzas : Pizza margarita, Pizza merguez, Pâtes bio à l’orientale',
  );
  assert.equal(lastText(world, device, 'dinner'), 'Menu non communiqué');
  assert.equal(lastText(world, device, 'vegetarian'), 'aucun signalé');
  // Closed for the holidays.
  const esplanade = await create(world, ESPLANADE);
  assert.equal(lastState(world, esplanade, 'open_today'), 0);
  assert.equal(lastText(world, esplanade, 'lunch'), 'Fermé');
  assert.equal(lastText(world, esplanade, 'vegetarian'), '—');
});

test('the day changes at midnight (Paris): new menu, closure, not published', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const insa = await create(world, INSA);
  const arsenal = await create(world, ARSENAL);
  // Before its first day published (holidays): no service.
  assert.equal(lastText(world, insa, 'lunch'), 'Pas de service');
  // Monday 2 November: the Insa reopens, a vegetarian dish is marked.
  await tickAt(world, '2026-11-02', '00:05');
  assert.equal(lastState(world, insa, 'open_today'), 1);
  assert.match(lastText(world, insa, 'lunch'), /^Entrees : Croisillon Dubarry/);
  assert.equal(lastText(world, insa, 'vegetarian'), 'Veg Galette épinard brebis');
  assert.equal(lastText(world, insa, 'dinner'), 'Pas de service');
  // The Arsenal publishes nothing on that day, before its closure on the 11th.
  assert.equal(lastText(world, arsenal, 'lunch'), 'Pas de service');
  assert.equal(lastState(world, arsenal, 'open_today'), 0);
  // 12 November: after the last day published.
  await tickAt(world, '2026-11-12', '09:00');
  assert.equal(lastText(world, arsenal, 'lunch'), 'Menu pas encore publié');
});

test('the states are only sent again when they change', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, ARSENAL);
  const before = world.fake.states.length;
  await tickAt(world, '2026-10-29', '12:10');
  await tickAt(world, '2026-10-29', '12:20');
  assert.equal(world.fake.states.length, before);
});

test('a feed is read every few hours, with its ETag, a failed one again after a delay', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'], refresh_interval: '3' } });
  t.after(() => world.app.stop());
  const device = await create(world, ARSENAL);
  assert.equal(world.network.calls.length, 1);
  await tickAt(world, '2026-10-29', '14:00');
  assert.equal(world.network.calls.length, 1);
  world.network.routes.toulouse = 503;
  await tickAt(world, '2026-10-29', '15:10');
  assert.equal(world.network.calls.length, 2);
  // The menus already read stay on display.
  assert.match(lastText(world, device, 'lunch'), /^Plat : Steak de poulet/);
  world.clock.advance(RETRY_MS - 60000);
  await world.service.tick();
  assert.equal(world.network.calls.length, 2);
  world.clock.advance(60000);
  await world.service.tick();
  assert.equal(world.network.calls.length, 3);
  const report = await action(world, 'status');
  assert.match(report.fr, /Dernière erreur : webservices-v2\.crous-mobile\.fr: HTTP 503/);
  // A 304 keeps the restaurants read before.
  world.network.routes.toulouse = (url, init) => {
    assert.equal(init.headers['if-none-match'], undefined);
    return new Response(null, { status: 304 });
  };
  world.clock.advance(RETRY_MS);
  await world.service.tick();
  assert.match(lastText(world, device, 'lunch'), /^Plat : Steak de poulet/);
});

test('watched dish: today in the morning window, tomorrow in the evening, once', async (t) => {
  const world = await createWorld({
    config: { crous: ['toulouse'], watched_words: 'Pizza, galette' },
  });
  t.after(() => world.app.stop());
  const arsenal = await create(world, ARSENAL);
  await create(world, INSA);
  await tickAt(world, '2026-10-29', '06:59');
  assert.deepEqual(world.fake.sceneEvents, []);
  await tickAt(world, '2026-10-29', '07:00');
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.day, e.data.word, e.data.dish, e.data.meal]),
    [['watched_dish', 'today', 'pizza', 'Pizza margarita', 'Midi']],
  );
  const [event] = world.fake.sceneEvents;
  assert.equal(event.data.restaurant, arsenal.external_id);
  assert.equal(event.data.restaurant_name, ARSENAL);
  assert.match(event.data.menu_text, /^Plat : Steak/);
  await tickAt(world, '2026-10-29', '09:30');
  assert.equal(world.fake.sceneEvents.length, 1);
  // Sunday evening: Monday's menu of the Insa, with a galette.
  await tickAt(world, '2026-11-01', '17:00');
  assert.deepEqual(
    world.fake.sceneEvents.slice(1).map((e) => [e.key, e.data.day, e.data.date, e.data.dish]),
    [
      ['tomorrow_menu_published', 'tomorrow', '2026-11-02', undefined],
      ['watched_dish', 'tomorrow', '2026-11-02', 'Pizza kebab'],
      ['watched_dish', 'tomorrow', '2026-11-02', 'Veg Galette épinard brebis'],
    ],
  );
  assert.match(world.fake.sceneEvents[1].data.menu_text, /^Midi : Entrees : /);
});

test('tomorrow_menu_published: not for a closure; a restart does not fire twice', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'gladys-crous-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const first = await createWorld({ dataDir: dir });
  const riquet = await create(first, RIQUET);
  await create(first, ESPLANADE);
  await tickAt(first, '2026-10-29', '18:00');
  assert.deepEqual(
    first.fake.sceneEvents.map((e) => [e.key, e.data.restaurant_name, e.data.date]),
    [['tomorrow_menu_published', RIQUET, '2026-10-30']],
  );
  await first.app.stop();
  assert.equal(JSON.parse(await readFile(join(dir, 'fired.json'), 'utf8')).length, 1);

  const second = await createWorld({ dataDir: dir, devices: [riquet] });
  t.after(() => second.app.stop());
  await tickAt(second, '2026-10-29', '18:20');
  assert.deepEqual(second.fake.sceneEvents, []);
});

test('scene action: the menu of the day in a sentence, a number for the conditions', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await world.fake.sceneAction('menu_of_day', {});
  assert.equal(empty.success, false);
  const arsenal = await create(world, ARSENAL);
  const esplanade = await create(world, ESPLANADE);
  const lunch = await world.fake.sceneAction('menu_of_day', {
    restaurant: arsenal.external_id,
    meal: 'lunch',
  });
  assert.equal(lunch.success, true);
  assert.match(
    lunch.data.outputs.sentence,
    /^Resto U' Arsenal, aujourd'hui\. Midi : Plat : Steak de poulet à la moutarde, .* Pâtes bio à l’orientale\.$/,
  );
  assert.equal(lunch.data.outputs.has_menu, 1);
  const dinner = await world.fake.sceneAction('menu_of_day', {
    restaurant: arsenal.external_id,
    meal: 'dinner',
  });
  assert.equal(
    dinner.data.outputs.sentence,
    "Resto U' Arsenal, aujourd'hui. Soir : Menu non communiqué.",
  );
  assert.equal(dinner.data.outputs.has_menu, 0);
  const closed = await world.fake.sceneAction('menu_of_day', {
    restaurant: esplanade.external_id,
    day: 'tomorrow',
  });
  assert.equal(closed.data.outputs.sentence, "Brasserie L'esplanade, demain. Midi : Fermé.");
  assert.equal(closed.data.outputs.has_menu, 0);
  const all = await world.fake.sceneAction('menu_of_day', {});
  assert.match(
    all.data.outputs.sentence,
    /^Resto U' Arsenal, aujourd'hui\. .* Brasserie L'esplanade/,
  );
  assert.equal(all.data.outputs.has_menu, 1);
  const gone = await world.fake.sceneAction('menu_of_day', { restaurant: 'ext:x:gone' });
  assert.equal(gone.success, false);
});

test("widget: today's and tomorrow's menus, a badge for vegetarian, hideable parts", async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const nothing = await world.fake.widgetGet('menus', { settings: {}, language: 'en' });
  assert.equal(nothing.data.content.components[0].type, 'text');
  const insa = await create(world, INSA);
  await create(world, ESPLANADE);
  // Sunday 1 November: tomorrow, the Insa reopens.
  world.clock.set(paris('2026-11-01', '12:00'));
  const ack = await world.fake.widgetGet('menus', { settings: {}, language: 'fr' });
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  const [list] = content.components;
  assert.equal(list.type, 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle]),
    [
      ["Resto U' Insa · Aujourd'hui", 'Pas de service'],
      ["Resto U' Insa · Demain", 'Œuf brouillé champignon, Fish and chips, Pizza kebab, Veg G…'],
      ["Brasserie L'esplanade · Aujourd'hui", 'Pas de service'],
      // Only its prices are published: open, menu not given.
      ["Brasserie L'esplanade · Demain", 'Menu non communiqué'],
    ],
  );
  assert.equal(list.items[1].badge.text, 'Végé');
  assert.match(list.items[1].description, /^■ Midi\nEntrees : Croisillon Dubarry/);
  const short = await world.fake.widgetGet('menus', {
    settings: { restaurants: [insa.external_id], show_tomorrow: false, show_dinner: false },
    language: 'en',
  });
  const items = short.data.content.components[0].items;
  assert.deepEqual(
    items.map((item) => item.title),
    ["Resto U' Insa · Today"],
  );
});

test('widget: a closure shows the notice of the Crous in the detail', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, ESPLANADE);
  const ack = await world.fake.widgetGet('menus', {
    settings: { show_tomorrow: false },
    language: 'fr',
  });
  const [item] = ack.data.content.components[0].items;
  assert.equal(item.subtitle, 'Fermé');
  assert.match(item.description, /^■ Midi\nFermé\nStructure fermée du /);
  assert.equal(item.badge, undefined);
});

test('widget: many restaurants, today only, then a caption for those left out', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'] } });
  t.after(() => world.app.stop());
  for (const device of world.fake.discoveredDevices.slice(0, 10)) {
    await world.fake.deviceCreated(device);
  }
  const ack = await world.fake.widgetGet('menus', { settings: {}, language: 'en' });
  const [list, caption] = ack.data.content.components;
  assert.equal(list.items.length, 8);
  assert.ok(list.items.every((item) => item.title.endsWith('· Today')));
  assert.equal(caption.text, '2 more restaurants: pick fewer in the settings');
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  // Never cached past midnight.
  world.clock.set(paris('2026-10-29', '23:50'));
  const late = await world.fake.widgetGet('menus', { settings: {}, language: 'en' });
  assert.equal(late.data.content.ttl_seconds, 660);
});

test('status action and language change', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'], watched_words: 'frites' } });
  t.after(() => world.app.stop());
  const device = await create(world, ARSENAL);
  const report = await action(world, 'status');
  assert.match(report.fr, /■ Crous Toulouse Occitanie : 44 restaurants, \d+ avec un menu/);
  assert.match(report.fr, /Menus publiés jusqu'au 2026-1\d-\d\d\./);
  assert.match(report.en, /Watched words: frites\./);
  await world.fake.configUpdated({ crous: ['toulouse'], language: 'en' });
  assert.equal(lastText(world, device, 'dinner'), 'Menu not communicated');
});

test('a restaurant gone from its feed shows "not published" on its own features', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'] } });
  t.after(() => world.app.stop());
  const device = await create(world, ARSENAL);
  const feed = world.network.routes.toulouse;
  world.network.routes.toulouse = {
    restaurants: feed.restaurants.filter((r) => r.id !== 167),
  };
  await world.service.refresh();
  assert.equal(lastText(world, device, 'lunch'), 'Menu pas encore publié');
  assert.equal(lastState(world, device, 'open_today'), 0);
  assert.ok(!world.fake.discoveredDevices.some((d) => d.name === ARSENAL));
});
