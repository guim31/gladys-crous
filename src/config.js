// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

import { CROUS_KEYS } from './sources.js';
import { wordsOf } from './text.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Hours between two readings of a feed. The menus are published days or
// weeks ahead and seldom change: a few readings a day are plenty. The
// integration drives its own timer (devices are published with
// should_poll: false).
export const REFRESH_INTERVALS = ['3', '6', '12'];

// Restaurants offered in the Discover tab, around the home position (km).
export const DISTANCES = ['all', '2', '5', '10', '25'];

export const DEFAULT_CONFIG = {
  crous: [],
  home_position: '',
  max_distance: 'all',
  watched_words: '',
  refresh_interval: '6',
  language: 'fr',
};

/** The Crous chosen: an array from the form, tolerating a JSON or comma-separated string. */
function crousOf(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      list = value.split(',');
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const wanted = list.map((item) => String(item).trim());
  return CROUS_KEYS.filter((key) => wanted.includes(key));
}

/**
 * "43.6045, 1.4440" (or with a comma as decimal separator: "43,6045; 1,4440")
 * → { lat, lon }, or null.
 */
export function positionOf(value) {
  const text = String(value ?? '').trim();
  const numbers =
    text.includes(';') || (text.match(/,/g) ?? []).length !== 1
      ? text.split(/[;\s]+/).map((part) => part.replace(',', '.'))
      : text.split(',');
  const values = numbers.map((part) => part.trim()).filter(Boolean);
  if (values.length !== 2) {
    return null;
  }
  const [lat, lon] = values.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon };
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const interval = REFRESH_INTERVALS.includes(String(source.refresh_interval))
    ? String(source.refresh_interval)
    : DEFAULT_CONFIG.refresh_interval;
  const distance = DISTANCES.includes(String(source.max_distance))
    ? String(source.max_distance)
    : DEFAULT_CONFIG.max_distance;
  const home = positionOf(source.home_position);
  return {
    crous: crousOf(source.crous),
    home,
    maxDistanceKm: home && distance !== 'all' ? Number(distance) : null,
    words: wordsOf(source.watched_words),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    refreshMs: Number(interval) * 3600 * 1000,
  };
}
