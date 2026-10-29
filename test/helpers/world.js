// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake `fetch` serving the
// real feeds of the Crous of Toulouse and Rennes (captured on 2026-10-29,
// trimmed to the fields read, see test/fixtures/sources), a manual clock,
// and the integration wired on top
// through registerHandlers. Nothing touches the network, nothing is written
// to disk unless a test gives a data directory.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

process.env.LOG_LEVEL ??= 'silent';

export const fixtureJson = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/sources/${name}`, import.meta.url), 'utf8'));

/** An instant from a Paris wall-clock time (the fixtures are in autumn: UTC+1 after 25/10). */
export const paris = (date, time = '12:00') => Date.parse(`${date}T${time}:00+01:00`);

// Thursday 2026-10-29, noon in Paris: the day of the capture, outside the
// trigger windows.
export const FIXTURE_TIME = paris('2026-10-29', '12:00');

// The feeds served, by Crous key (the folder of the request path).
export const FEEDS = ['toulouse', 'rennes'];

/**
 * A fake `fetch`: `routes[crous]` is a JSON value, a status number, a
 * Response, an Error (network failure) or a function returning one of them.
 * Every call is recorded in `calls`.
 */
export function createFetch(overrides = {}) {
  const routes = {
    ...Object.fromEntries(FEEDS.map((key) => [key, fixtureJson(`${key}.json`)])),
    ...overrides,
  };
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    const key = /\/feed\/([^/]+)\/externe\//.exec(String(url))?.[1];
    let route = routes[key];
    if (typeof route === 'function') {
      route = await route(url, init);
    }
    if (route instanceof Error) {
      throw route;
    }
    if (route === undefined) {
      return new Response('not found', { status: 404 });
    }
    if (route instanceof Response) {
      return route;
    }
    if (typeof route === 'number') {
      return new Response('error', { status: route });
    }
    return new Response(JSON.stringify(route), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls, routes };
}

/** A manual clock. */
export function createClock(start = FIXTURE_TIME) {
  const clock = {
    time: start,
    now: () => clock.time,
    set(ms) {
      clock.time = ms;
    },
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.network] from createFetch
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {string|null} [options.dataDir]
 */
export async function createWorld({
  config = { crous: ['toulouse', 'rennes'] },
  network = createFetch(),
  devices = [],
  connect = true,
  clock = createClock(),
  dataDir = null,
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: network.fetch,
    timers: false,
    now: clock.now,
    dataDir,
  });
  const world = { gladys, fake: gladys.fake, app, service: app.service, network, clock };
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.service.loading;
  }
  return world;
}

/** Run a configuration action; resolves with its message (multi-language). */
export async function action(world, key, fields = {}) {
  const ack = await world.fake.action(key, fields);
  if (!ack.success) {
    throw new Error(`${key} failed: ${ack.error}`);
  }
  return ack.data.message;
}

/** The device published under a name, or a predicate, from the last discovery list. */
export const discovered = (world, predicate) =>
  world.fake.discoveredDevices.find(
    typeof predicate === 'function' ? predicate : (d) => d.name === predicate,
  );

/** Create a discovered device in Gladys, as the user would. */
export async function create(world, predicate) {
  const device = discovered(world, predicate);
  if (!device) {
    throw new Error(`${predicate} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** The last text published on a feature. */
export function lastText(world, device, key) {
  const id = featureId(device, key);
  const states = world.fake.states.filter((s) => s.device_feature_external_id === id);
  return states.at(-1)?.text;
}

/** One timer tick at a Paris time. */
export async function tickAt(world, date, time) {
  world.clock.set(paris(date, time));
  await world.service.tick();
}

/** Captures what the integration logs, at a level. */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
