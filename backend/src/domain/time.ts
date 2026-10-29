import { DomainError } from "./DomainError.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const formatterFor = (timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

export function assertDateAndTime(date: string, time: string, timeZone: string): void {
  if (!datePattern.test(date) || !timePattern.test(time)) {
    throw new DomainError("Use a date in YYYY-MM-DD and a time in HH:mm format.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const checkDate = new Date(Date.UTC(year, month - 1, day));
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    throw new DomainError("The selected date is not valid.");
  }

  try {
    formatterFor(timeZone).format(new Date());
  } catch {
    throw new DomainError(`"${timeZone}" is not a supported business time zone.`);
  }
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  assertDateAndTime(date, time, timeZone);

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = formatterFor(timeZone);
  let timestamp = desiredUtc;

  // Adjust the UTC guess until it formats back to the requested clinic-local time.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value])
    );
    const displayedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    const difference = desiredUtc - displayedUtc;
    if (difference === 0) return new Date(timestamp);
    timestamp += difference;
  }

  throw new DomainError("The selected local time does not exist in the business time zone.");
}

export function getLocalDateParts(
  date: Date,
  timeZone: string
): { date: string; time: string; weekday: number } {
  const parts = Object.fromEntries(
    formatterFor(timeZone).formatToParts(date).map(({ type, value }) => [type, value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
    ).getUTCDay()
  };
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
