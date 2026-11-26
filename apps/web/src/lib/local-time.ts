// Times in the API's messages are exact UTC timestamps ("…resets at 2026-11-27T00:00:00.000Z"),
// which suit the CLI and scripts. People see them in their own time instead: "8:00 AM tomorrow
// (your time)".

const ISO_TIME = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g;

export interface LocalTimeOptions {
  /** Tests pin these; the browser's own are used otherwise. */
  locale?: string;
  timeZone?: string;
}

/** The calendar day of `date` in the time zone, as YYYY-MM-DD, for comparing days. */
function dayOf(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** One time as people read it: "8:00 AM today", "8:00 AM tomorrow", or with its date. */
export function localTime(date: Date, now: Date, options: LocalTimeOptions = {}): string {
  const { locale, timeZone } = options;
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(/\u202f/g, " ");
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayOf(date, timeZone) === dayOf(now, timeZone)) return `${time} today`;
  if (dayOf(date, timeZone) === dayOf(tomorrow, timeZone)) return `${time} tomorrow`;
  const day = new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric" }).format(
    date,
  );
  return `${time} on ${day}`;
}

/** Replace every UTC timestamp in a message with the reader's local time. */
export function withLocalTimes(
  message: string,
  now: Date = new Date(),
  options: LocalTimeOptions = {},
): string {
  return message.replace(ISO_TIME, (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : `${localTime(date, now, options)} (your time)`;
  });
}
