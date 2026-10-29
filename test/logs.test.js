// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a feed lost and back), never one line per reading; a failure
// that repeats is logged once, plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureLogs, create, createWorld } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), [
    '[INFO] [crous] Started: 2 Crous chosen, 0 restaurant(s) added',
  ]);
});

test('normal cycles write nothing at info, one line per reading at debug', async (t) => {
  const world = await createWorld({ config: { crous: ['toulouse'] } });
  t.after(() => world.app.stop());
  await create(world, "Resto U' Arsenal");
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 6; i += 1) {
    world.clock.advance(2 * 3600 * 1000);
    await world.service.tick();
  }
  assert.deepEqual(lines, []);
  const debug = captureLogs(t, 'debug');
  await world.service.refresh();
  assert.deepEqual(debug.map(strip), ['[DEBUG] [crous] Toulouse Occitanie: 44 restaurants read']);
});

test('a feed down: one warning, then one line at recovery', async (t) => {
  const world = await createWorld({ config: { crous: ['rennes'] } });
  t.after(() => world.app.stop());
  const saved = world.network.routes.rennes;
  const lines = captureLogs(t, 'info');
  world.network.routes.rennes = new TypeError('fetch failed');
  for (let i = 0; i < 4; i += 1) {
    await world.service.refresh();
  }
  world.network.routes.rennes = saved;
  await world.service.refresh();
  assert.deepEqual(lines.map(strip), [
    '[WARN] [crous] Rennes Bretagne: data unavailable: webservices-v2.crous-mobile.fr: fetch failed',
    '[INFO] [crous] Rennes Bretagne: data back',
  ]);
});
