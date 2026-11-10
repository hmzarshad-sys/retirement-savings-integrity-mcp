// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// Date helpers in UTC, and business days excluding weekends and US federal
// holidays (5 U.S.C. 6103), with Saturday holidays observed on Friday and
// Sunday holidays on Monday.

export function parseDate(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { y = +m[3]; mo = +m[1]; d = +m[2]; }
  else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export const iso = (d) => (d ? d.toISOString().slice(0, 10) : '');
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + shift + 7 * (n - 1)));
}
function lastWeekday(year, month, weekday) {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - shift));
}
function observed(d) {
  const w = d.getUTCDay();
  if (w === 6) return addDays(d, -1);
  if (w === 0) return addDays(d, 1);
  return d;
}

const cache = new Map();
export function federalHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const days = [
    observed(new Date(Date.UTC(year, 0, 1))),   // New Year's Day
    nthWeekday(year, 0, 1, 3),                  // Martin Luther King Jr. Day
    nthWeekday(year, 1, 1, 3),                  // Washington's Birthday
    lastWeekday(year, 4, 1),                    // Memorial Day
    observed(new Date(Date.UTC(year, 5, 19))),  // Juneteenth
    observed(new Date(Date.UTC(year, 6, 4))),   // Independence Day
    nthWeekday(year, 8, 1, 1),                  // Labor Day
    nthWeekday(year, 9, 1, 2),                  // Columbus Day
    observed(new Date(Date.UTC(year, 10, 11))), // Veterans Day
    nthWeekday(year, 10, 4, 4),                 // Thanksgiving
    observed(new Date(Date.UTC(year, 11, 25))), // Christmas
  ];
  // New Year's Day of the next year observed on Dec 31 of this year.
  const nextNy = observed(new Date(Date.UTC(year + 1, 0, 1)));
  if (nextNy.getUTCFullYear() === year) days.push(nextNy);
  const set = new Set(days.map(iso));
  cache.set(year, set);
  return set;
}

export function isBusinessDay(d) {
  const w = d.getUTCDay();
  if (w === 0 || w === 6) return false;
  return !federalHolidays(d.getUTCFullYear()).has(iso(d));
}

// Business days after `from` up to and including `to` (0 if same day or earlier).
export function businessDaysAfter(from, to) {
  if (to <= from) return 0;
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isBusinessDay(d)) n++;
  return n;
}

// The 15th business day of the month after the month containing `d`.
export function fifteenthBusinessDayOfNextMonth(d) {
  let cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  let n = 0;
  for (;;) {
    if (isBusinessDay(cur)) { n++; if (n === 15) return cur; }
    cur = addDays(cur, 1);
  }
}

export function ageOn(birth, on) {
  let a = on.getUTCFullYear() - birth.getUTCFullYear();
  const m = on.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) a--;
  return a;
}
