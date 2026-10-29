// -----------------------------------------------------------------------------
// Calendar helpers. Menus are dated by the Crous: "today" is always the
// day in Paris, whatever the time zone of the Gladys host.
// -----------------------------------------------------------------------------

export const PARIS = 'Europe/Paris';

const parts = (ms) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: PARIS,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  );

/** "2026-10-29": the day in Paris at an instant. */
export function parisDate(ms) {
  const p = parts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes since midnight in Paris at an instant. */
export function parisMinutes(ms) {
  const p = parts(ms);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** "2026-10-29" + n days, in calendar days (no time zone involved). */
export function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The "YYYY-MM-DD" part of a date or date-time string, or null. */
export function dayOf(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : null;
}
