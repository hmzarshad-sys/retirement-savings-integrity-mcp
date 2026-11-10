// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// IRS dollar limits by calendar year. Sources: IRS cost-of-living
// announcements as summarized in docs/sources.md. Add a year here when the
// IRS publishes it; checks for a year with no entry are skipped, not guessed.

export const LIMITS = {
  2025: {
    elective_deferral: 23500,        // IRC 402(g)(1)
    catch_up_50: 7500,               // IRC 414(v)
    catch_up_60_63: 11250,           // IRC 414(v)(2)(E), SECURE 2.0 sec. 109
    roth_catch_up_wage_threshold: null, // mandatory Roth catch-up not effective in 2025
  },
  2026: {
    elective_deferral: 24500,
    catch_up_50: 8000,
    catch_up_60_63: 11250,
    roth_catch_up_wage_threshold: 150000, // prior-year (2025) FICA wages, IRC 414(v)(7)
  },
};

export function limitsFor(year) {
  return LIMITS[year] || null;
}

// Age on December 31 of the year decides catch-up eligibility (age 50+), and
// the 60–63 increased limit applies to those who attain 60–63 in the year.
export function catchUpLimit(year, birthDate) {
  const L = limitsFor(year);
  if (!L || !birthDate) return 0;
  const age = year - birthDate.getUTCFullYear();
  if (age >= 60 && age <= 63) return L.catch_up_60_63;
  if (age >= 50) return L.catch_up_50;
  return 0;
}
