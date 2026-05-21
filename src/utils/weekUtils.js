/**
 * Returns the ISO 8601 week ID (Mon–Sun) for a given date.
 * Format: "YYYY-WNN" e.g. "2026-W19"
 * Week starts Monday 00:00:00 and ends Sunday 23:59:59.
 */
export function getWeekId(date = new Date()) {
  // Copy date so we don't mutate the original
  const d = new Date(date);

  // Shift to Monday-based week:
  // getDay() returns 0=Sun, 1=Mon ... 6=Sat
  // We want Monday = day 0, so offset = (getDay() + 6) % 7
  const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6

  // Find the Monday of this week
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);

  // ISO week number: use Thursday of the same week (ISO standard)
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);

  const year = thursday.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  // Find the first Thursday of the year
  const firstThursday = new Date(startOfYear);
  firstThursday.setDate(1 + ((4 - startOfYear.getDay() + 7) % 7));

  const weekNum = 1 + Math.round((thursday - firstThursday) / (7 * 86400000));

  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Returns the Monday (start) of the week for the given date at 00:00:00.
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the Sunday (end) of the week for the given date at 23:59:59.
 */
export function getWeekEnd(date = new Date()) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
