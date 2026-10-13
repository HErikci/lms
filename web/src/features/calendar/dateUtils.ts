const pad = (n: number) => String(n).padStart(2, '0');

/** Yerel tarih -> "YYYY-MM-DD". */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Yerel tarih-saat -> "YYYY-MM-DDTHH:mm" (datetime-local değeri). */
export function toDateTimeInput(date: Date): string {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM-DD" değerini yerel gece yarısı olarak çözer (UTC kaymasını önler). */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** API tarihini Date'e çevirir: tarih-only yerel, ISO UTC olduğu gibi. */
export function parseEventDate(value: string): Date {
  return value.length === 10 ? parseDateInput(value) : new Date(value);
}

export function addDaysToDateInput(value: string, days: number): string {
  const date = parseDateInput(value);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}
