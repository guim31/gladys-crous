// -----------------------------------------------------------------------------
// The integration at runtime: the feeds read, their restaurants, the timer,
// the devices offered in the Discover tab, the states of the restaurants
// added to Gladys, and the scene triggers.
//
// Data flow: every Crous ticked in the configuration, plus every Crous with
// a restaurant added to Gladys, is read every few hours (one request per
// Crous, conditional on its ETag). The restaurants of the ticked Crous
// (around home when a position and a distance are set) are offered in the
// Discover tab; the ones the user adds are the "watched" restaurants:
// states, widget, triggers and scene action. A short tick recomputes
// today's states (the day changes at midnight, Paris time) and fires the
// triggers in their time windows.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js';
import { addDays, parisDate, parisMinutes } from './dates.js';
import {
  RESTAURANT_TYPE,
  SLOTS,
  buildRestaurantDevice,
  dishesOf,
  lastDateOf,
  mealText,
  restaurantPlatformId,
  restaurantStates,
  servesOn,
  slotText,
} from './devices.js';
import { REPORTS, TEXT, lines, render, say } from './messages.js';
import { CROUS, CROUS_KEYS, readFeed } from './sources.js';
import { clip, hasWord } from './text.js';

const logger = createLogger({ name: 'crous' });

// Today's states are recomputed this often (the day changes at midnight).
export const TICK_MS = 10 * 60 * 1000;
// A feed that failed is read again after this delay, not at every tick.
export const RETRY_MS = 30 * 60 * 1000;
// Unchanged states (a restaurant closed for the holidays) are sent again
// this often, or the dashboard shows "no recent value" after 48 hours.
export const HEARTBEAT_MS = 6 * 3600 * 1000;

export const TRIGGERS = {
  WATCHED_DISH: 'watched_dish',
  MENU_PUBLISHED: 'tomorrow_menu_published',
};
// When the triggers fire, in minutes since midnight (Paris): today's menu in
// the morning, tomorrow's in the evening. A container started inside a
// window fires what it has not fired yet (remembered in /data).
export const WINDOWS = [
  { day: 'today', offset: 0, from: 7 * 60, to: 10 * 60 },
  { day: 'tomorrow', offset: 1, from: 17 * 60, to: 22 * 60 },
];
export const DAYS = WINDOWS.map((window) => window.day);

export const WIDGET_KEY = 'menus';
const FIRED_FILE = 'fired.json';

/** Distance in km between two { lat, lon }. */
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** One regional feed at runtime: its restaurants, and how its last readings went. */
class Feed {
  constructor(key) {
    this.key = key;
    this.name = CROUS[key];
    this.restaurants = null; // Map restaurant id → restaurant
    this.etag = null;
    this.okAt = null;
    this.failedAt = null;
    this.error = null;
  }
}

export class CrousMenus {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   * @param {boolean} [options.timers] false in the tests: they call tick()
   * @param {string|null} [options.dataDir] where the fired triggers are remembered
   */
  constructor({
    gladys,
    fetch = globalThis.fetch,
    now = Date.now,
    timers = true,
    dataDir = '/data',
  }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.now = now;
    this.useTimers = timers;
    this.dataDir = dataDir;
    this.config = normalizeConfig(DEFAULT_CONFIG);
    this.feeds = new Map(); // key → Feed
    this.fired = new Set();
    this.discoveredSignature = null;
    this.publishFailed = false;
    this.discoveryFailed = false;
    this.fireFailed = false;
    this.saveFailed = false;
    this.timer = null;
    this.stopped = false;
    this.running = null;
    this.loading = Promise.resolve();
  }

  // --- lifecycle --------------------------------------------------------------

  async start(config) {
    this.config = config;
    await this.loadFired();
    this.schedule();
    logger.info(
      `Started: ${config.crous.length} Crous chosen, ${this.watched().length} restaurant(s) added`,
    );
    // The first reading in the background: the widget and the scene action
    // wait for it.
    this.loading = this.refresh({ discover: true });
  }

  /** Gladys restarted: everything again, the states included. */
  async resync(config) {
    this.config = config;
    this.gladys.forgetPublishedStates?.();
    await this.refresh({ discover: true });
    this.refreshWidget();
  }

  async reconfigure(config) {
    const languageChanged = config.language !== this.config.language;
    this.config = config;
    if (languageChanged) {
      // The state texts follow the language.
      this.gladys.forgetPublishedStates?.();
    }
    await this.refresh({ discover: true });
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.running;
  }

  schedule() {
    if (!this.useTimers || this.stopped) {
      return;
    }
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  // --- devices ----------------------------------------------------------------

  deviceId(crousKey, restaurantId) {
    return this.gladys.externalIds(RESTAURANT_TYPE, restaurantPlatformId(crousKey, restaurantId))
      .device;
  }

  /** The restaurants added to Gladys: `{ deviceId, key, restaurantId, name }[]`. */
  watched() {
    return (this.gladys.devices ?? [])
      .map((device) => {
        const param = (name) => device.params?.find?.((p) => p.name === name)?.value ?? null;
        return {
          deviceId: device.external_id,
          key: CROUS_KEYS.includes(param('crous')) ? param('crous') : null,
          restaurantId: param('restaurant_id') === null ? null : String(param('restaurant_id')),
          name: device.name,
        };
      })
      .filter((entry) => entry.key && entry.restaurantId);
  }

  /** The feeds to read: the ones ticked, and the ones of the restaurants added. */
  activeKeys() {
    const keys = new Set([...this.config.crous, ...this.watched().map((entry) => entry.key)]);
    return CROUS_KEYS.filter((key) => keys.has(key));
  }

  feed(key) {
    if (!this.feeds.has(key)) {
      this.feeds.set(key, new Feed(key));
    }
    return this.feeds.get(key);
  }

  /**
   * The restaurant of a watched device: `{ entry, feed, restaurant }`.
   * `restaurant` is null while its feed has never been read; a restaurant
   * the feed no longer lists has no day.
   */
  lookup(deviceId) {
    const entry = this.watched().find((w) => w.deviceId === deviceId);
    if (!entry) {
      return null;
    }
    const feed = this.feed(entry.key);
    if (!feed.restaurants) {
      return { entry, feed, restaurant: null };
    }
    const restaurant = feed.restaurants.get(entry.restaurantId) ?? {
      id: entry.restaurantId,
      days: new Map(),
    };
    return { entry, feed, restaurant };
  }

  today() {
    return parisDate(this.now());
  }

  /** Waits for the first reading (at most `ms`), for a widget or a scene action asked at start. */
  async firstReading(ms = 15000) {
    let timer;
    await Promise.race([
      this.loading,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
    clearTimeout(timer);
  }

  /** The restaurants offered: the ticked Crous, around home when asked, nearest first. */
  offered() {
    const { home, maxDistanceKm } = this.config;
    const offered = [];
    for (const key of this.config.crous) {
      for (const restaurant of this.feeds.get(key)?.restaurants?.values() ?? []) {
        const located = home && restaurant.lat !== null && restaurant.lon !== null;
        const distance = located ? distanceKm(home, restaurant) : null;
        if (maxDistanceKm !== null && (distance === null || distance > maxDistanceKm)) {
          continue;
        }
        offered.push({ key, restaurant, distance });
      }
    }
    if (home) {
      offered.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return offered;
  }

  async publishDiscovered({ force = false } = {}) {
    const devices = this.offered().map(({ key, restaurant }) =>
      buildRestaurantDevice(this.gladys, key, restaurant, this.config.language),
    );
    const signature = JSON.stringify(devices.map((d) => [d.external_id, d.name, d.features]));
    if (!force && signature === this.discoveredSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discoveredSignature = signature;
      if (this.discoveryFailed) {
        this.discoveryFailed = false;
        logger.info('Discovered restaurants published again');
      }
    } catch (err) {
      if (!this.discoveryFailed) {
        logger.warn(`Cannot publish the discovered restaurants: ${err.message}`);
      }
      this.discoveryFailed = true;
    }
  }

  async publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (this.publishFailed) {
        this.publishFailed = false;
        logger.info('States published again');
      }
    } catch (err) {
      // Gladys restarting: said once, the next tick sends them again.
      if (!this.publishFailed) {
        logger.warn(`Cannot publish ${states.length} state(s): ${err.message}`);
      }
      this.publishFailed = true;
    }
  }

  statesOf(found) {
    return restaurantStates(
      this.gladys,
      found.entry.key,
      found.restaurant,
      this.today(),
      this.config.language,
    );
  }

  refreshWidget() {
    this.gladys.requestWidgetRefresh?.(WIDGET_KEY)?.catch?.(() => {});
  }

  /** A device was just added in Gladys: its states, all of them, now. */
  async onDeviceCreated(device) {
    const found = this.lookup(device?.external_id);
    if (found?.restaurant) {
      await this.publish(this.statesOf(found));
    } else if (found && !this.feed(found.entry.key).okAt) {
      // A Crous not ticked any more: read it, the cycle publishes the states.
      await this.refresh();
    }
    this.refreshWidget();
  }

  // --- reading ------------------------------------------------------------------

  /** Reads every active feed now (start, scan, new configuration). */
  refresh({ discover = false } = {}) {
    return this.run(() => this.cycle({ readAll: true, discover }));
  }

  /** The timer: reads the feeds that are due, then states and triggers. */
  tick() {
    return this.run(() => this.cycle({ readAll: false, discover: false }));
  }

  /** One cycle at a time; a cycle asked during another one runs right after it. */
  run(work) {
    const previous = this.running ?? Promise.resolve();
    const next = previous.then(work).catch((err) => logger.warn(`Refresh failed: ${err.message}`));
    this.running = next;
    next.finally(() => {
      if (this.running === next) {
        this.running = null;
      }
    });
    return next;
  }

  isDue(feed) {
    const now = this.now();
    if (feed.okAt === null && feed.failedAt === null) {
      return true;
    }
    if (feed.error) {
      return now - feed.failedAt >= RETRY_MS;
    }
    return now - feed.okAt >= this.config.refreshMs;
  }

  async cycle({ readAll, discover }) {
    let read = false;
    for (const key of this.activeKeys()) {
      const feed = this.feed(key);
      if (readAll || this.isDue(feed)) {
        read = (await this.readOne(feed)) || read;
      }
    }
    if (read || discover) {
      await this.publishDiscovered({ force: discover });
    }
    const states = [];
    for (const entry of this.watched()) {
      const found = this.lookup(entry.deviceId);
      if (found?.restaurant) {
        states.push(...this.statesOf(found));
      }
    }
    await this.publish(states);
    await this.fireTriggers();
  }

  /** Reads a feed; a failure is logged once, until it works again. */
  async readOne(feed) {
    try {
      const answer = await readFeed(feed.key, this.fetch, this.today(), feed.etag);
      if (!answer.notModified) {
        feed.restaurants = answer.restaurants;
        feed.etag = answer.etag;
      }
      feed.okAt = this.now();
      if (feed.error) {
        logger.info(`${feed.name}: data back`);
      }
      feed.error = null;
      feed.failedAt = null;
      logger.debug(
        answer.notModified
          ? `${feed.name}: not modified`
          : `${feed.name}: ${feed.restaurants.size} restaurants read`,
      );
      return !answer.notModified;
    } catch (err) {
      if (!feed.error) {
        logger.warn(`${feed.name}: data unavailable: ${err.message}`);
      }
      feed.error = err.message;
      feed.failedAt = this.now();
      return false;
    }
  }

  // --- scene triggers -------------------------------------------------------------

  /** A watched restaurant on a day ('today' or 'tomorrow'): `{ found, date }`. */
  dayOf(deviceId, day) {
    const window = WINDOWS.find((w) => w.day === day) ?? WINDOWS[0];
    return { found: this.lookup(deviceId), date: addDays(this.today(), window.offset) };
  }

  /** The events of one watched restaurant for one day. */
  restaurantEvents(entry, day) {
    const { found, date } = this.dayOf(entry.deviceId, day);
    const restaurant = found?.restaurant;
    if (!restaurant || !servesOn(restaurant, date)) {
      return [];
    }
    const language = this.config.language;
    const base = {
      restaurant: entry.deviceId,
      day,
      restaurant_name: entry.name,
      date,
    };
    const events = [];
    if (day === 'tomorrow') {
      events.push({
        key: TRIGGERS.MENU_PUBLISHED,
        data: { ...base, menu_text: clip(this.dayText(restaurant, date, language), 1000) },
      });
    }
    for (const slot of SLOTS) {
      const meal = restaurant.days.get(date)?.[slot];
      const dishes = dishesOf(meal);
      for (const word of this.config.words) {
        const dish = dishes.find((name) => hasWord(name, word));
        if (dish) {
          events.push({
            key: TRIGGERS.WATCHED_DISH,
            slot,
            data: {
              ...base,
              word,
              meal: say(TEXT, language, slot),
              dish: clip(dish, 1000),
              menu_text: clip(mealText(meal, language), 1000),
            },
          });
        }
      }
    }
    return events.map((event) => ({
      ...event,
      id: `${event.key}|${entry.deviceId}|${date}|${day}|${event.slot ?? ''}|${event.data.word ?? ''}`,
    }));
  }

  async fireTriggers() {
    const minutes = parisMinutes(this.now());
    const open = WINDOWS.filter((w) => minutes >= w.from && minutes < w.to);
    if (open.length === 0) {
      return;
    }
    let fired = false;
    for (const window of open) {
      for (const entry of this.watched()) {
        for (const event of this.restaurantEvents(entry, window.day)) {
          if (this.fired.has(event.id)) {
            continue;
          }
          if (await this.fire(event.key, event.data)) {
            this.fired.add(event.id);
            fired = true;
          }
        }
      }
    }
    if (fired) {
      await this.saveFired();
    }
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      if (this.fireFailed) {
        this.fireFailed = false;
        logger.info('Scene triggers fired again');
      }
      return true;
    } catch (err) {
      if (!this.fireFailed) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
      this.fireFailed = true;
      return false;
    }
  }

  /** The triggers already fired, so that a restart in a window does not fire them twice. */
  async loadFired() {
    if (!this.dataDir) {
      return;
    }
    try {
      const saved = JSON.parse(await readFile(join(this.dataDir, FIRED_FILE), 'utf8'));
      this.fired = new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch {
      this.fired = new Set();
    }
  }

  async saveFired() {
    // Only the last days matter.
    const oldest = addDays(this.today(), -2);
    this.fired = new Set([...this.fired].filter((id) => (id.split('|')[2] ?? '') >= oldest));
    if (!this.dataDir) {
      return;
    }
    try {
      await mkdir(this.dataDir, { recursive: true });
      const file = join(this.dataDir, FIRED_FILE);
      await writeFile(`${file}.tmp`, JSON.stringify([...this.fired]));
      await rename(`${file}.tmp`, file);
      this.saveFailed = false;
    } catch (err) {
      if (!this.saveFailed) {
        logger.warn(`Cannot remember the fired triggers: ${err.message}`);
      }
      this.saveFailed = true;
    }
  }

  // --- texts ------------------------------------------------------------------

  /** Lunch and dinner of a day in one text ("Midi : … — Soir : …"), the dinner only when served. */
  dayText(restaurant, date, language, slots = SLOTS) {
    const colon = language === 'fr' ? ' : ' : ': ';
    const parts = slots
      .filter((slot, index) => index === 0 || restaurant.days.get(date)?.[slot]?.status === 'menu')
      .map(
        (slot) =>
          `${say(TEXT, language, slot)}${colon}${slotText(restaurant, date, slot, language)}`,
      );
    return parts.join(' — ');
  }

  /** "Resto U' Arsenal, aujourd'hui : Midi : Plat : … — Soir : …." */
  sentence(entry, day, language, slots = SLOTS) {
    const { found, date } = this.dayOf(entry.deviceId, day);
    const dayText = say(TEXT, language, day === 'tomorrow' ? 'dayTomorrow' : 'dayToday');
    const restaurant = found?.restaurant ?? { days: new Map() };
    return say(TEXT, language, 'sentence', {
      name: entry.name,
      day: dayText,
      text: this.dayText(restaurant, date, language, slots),
    });
  }

  // --- configuration action -----------------------------------------------------

  status() {
    const now = this.now();
    const blocks = [];
    if (this.config.crous.length === 0) {
      blocks.push(render(REPORTS, 'noSource'));
    }
    if (this.config.home) {
      blocks.push(
        render(REPORTS, 'around', {
          km: this.config.maxDistanceKm,
          count: this.offered().length,
        }),
      );
    }
    for (const key of this.activeKeys()) {
      const feed = this.feed(key);
      const restaurants = [...(feed.restaurants?.values() ?? [])];
      const withMenu = restaurants.filter((r) => [...r.days.keys()].some((d) => servesOn(r, d)));
      const last = restaurants.map(lastDateOf).filter(Boolean).sort().at(-1);
      blocks.push(
        render(REPORTS, 'source', {
          name: feed.name,
          count: restaurants.length,
          menus: withMenu.length,
        }),
        feed.okAt === null
          ? render(REPORTS, 'waiting')
          : render(REPORTS, 'read', { age: Math.round((now - feed.okAt) / 60000) }),
        last ? render(REPORTS, 'lastDate', { date: last }) : null,
        feed.error ? render(REPORTS, 'error', { error: feed.error }) : null,
      );
    }
    blocks.push(render(REPORTS, 'watched', { count: this.watched().length }));
    if (this.config.words.length > 0) {
      blocks.push(render(REPORTS, 'words', { words: this.config.words.join(', ') }));
    }
    return lines(...blocks);
  }
}
