export type ExpiryClassification = 'invalid' | 'expired' | 'current' | 'long';

const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

  if (month === 2) {
    return leapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function oneCalendarYearAfter(value: Date): number {
  const year = value.getUTCFullYear() + 1;
  const month = value.getUTCMonth() + 1;
  const day = Math.min(value.getUTCDate(), daysInMonth(year, month));
  const boundary = new Date(value.getTime());

  boundary.setUTCFullYear(year, month - 1, day);
  return boundary.getTime();
}

export function parseRfc3339(value: string): Date | null {
  const match = RFC3339_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? '';
  const millisecond = Number(`${fraction}00`.slice(0, 3));
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millisecond);

  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second ||
    local.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  const offsetSign = match[9] === '-' ? -1 : 1;
  const offsetMilliseconds =
    offsetSign * (offsetHour * 60 + offsetMinute) * 60_000;
  const instant = new Date(local.getTime() - offsetMilliseconds);

  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function classifyExpiry(value: string, now: Date): ExpiryClassification {
  const expiry = parseRfc3339(value);
  const nowTime = now.getTime();

  if (!expiry || Number.isNaN(nowTime)) {
    return 'invalid';
  }

  if (expiry.getTime() < nowTime) {
    return 'expired';
  }

  return expiry.getTime() > oneCalendarYearAfter(now) ? 'long' : 'current';
}
