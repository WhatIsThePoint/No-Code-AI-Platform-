/**
 * Tiny relative-time formatter — kept dependency-free so we don't pull in
 * `date-fns` for one helper. Honors the active i18n language by leaning on
 * the browser's `Intl.RelativeTimeFormat` when available.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
  ["second", SECOND],
];

export function formatRelativeTime(iso: string | null | undefined, locale = "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const absDiff = Math.abs(diff);

  if (absDiff < 30 * SECOND) {
    // "just now" reads cleaner than "5 seconds ago" for chat-style stamps.
    return locale.startsWith("fr") ? "à l'instant" : "just now";
  }

  for (const [unit, ms] of UNITS) {
    if (absDiff >= ms || unit === "second") {
      const value = Math.round(diff / ms);
      try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        return rtf.format(value, unit);
      } catch {
        // Fallback for ancient browsers — synthesise an English string.
        const abs = Math.abs(value);
        return value < 0 ? `${abs} ${unit}${abs === 1 ? "" : "s"} ago` : `in ${abs} ${unit}${abs === 1 ? "" : "s"}`;
      }
    }
  }
  return "";
}
