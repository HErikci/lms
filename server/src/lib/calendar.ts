import { AppError } from '../errors.js';

export const EVENT_TYPES = ['lecture', 'lab', 'exam', 'deadline', 'holiday', 'event'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MAX_RANGE_DAYS = 400;
export const MAX_TIMED_DURATION_DAYS = 31;
export const MAX_TITLE = 200;
export const MAX_LOCATION = 200;
export const MAX_DESCRIPTION = 2000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

/** 'YYYY-MM-DD' (gerçek bir takvim günü) -> UTC gün başı; aksi halde null. */
export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Ofsetli (veya Z) ISO tarih-saat -> Date; aksi halde null. */
export function parseDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATETIME_RE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tarih ya da tarih-saat (sorgu aralığı için). */
export function parseInstant(value: unknown): Date | null {
  return parseDateOnly(value) ?? parseDateTime(value);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseRange(from: unknown, to: unknown): { from: Date; to: Date } {
  if (typeof from !== 'string' || typeof to !== 'string' || from === '' || to === '') {
    throw validation('from ve to zorunludur.');
  }
  const fromDate = parseInstant(from);
  const toDate = parseInstant(to);
  if (!fromDate || !toDate) {
    throw validation('from ve to ISO tarih (YYYY-MM-DD) veya ofsetli tarih-saat olmalıdır.');
  }
  if (toDate.getTime() <= fromDate.getTime()) {
    throw validation('to, from değerinden sonra olmalıdır.');
  }
  if (toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw validation(`Tarih aralığı en fazla ${MAX_RANGE_DAYS} gün olabilir.`);
  }
  return { from: fromDate, to: toDate };
}

export interface RawEventInput {
  title?: unknown;
  description?: unknown;
  type?: unknown;
  start?: unknown;
  end?: unknown;
  allDay?: unknown;
  location?: unknown;
  courseId?: unknown;
}

export interface EventData {
  title: string;
  description: string | null;
  type: EventType;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  courseId: string | null;
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw validation(`${field} metin olmalıdır.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw validation(`${field} en fazla ${max} karakter olabilir.`);
  return trimmed === '' ? null : trimmed;
}

/**
 * Ham girdiyi (oluşturma gövdesi ya da PATCH birleşimi) doğrular ve saklanacak biçime çevirir.
 * Tüm gün: start/end 'YYYY-MM-DD' (UTC gün başı, bitiş dahil değil; end yoksa start+1 gün).
 * Zamanlı: ofsetli ISO tarih-saat; end opsiyonel, verilirse start'tan sonra ve en fazla 31 gün.
 */
export function normalizeEventInput(raw: RawEventInput): EventData {
  if (typeof raw.title !== 'string') throw validation('title zorunludur.');
  const title = raw.title.trim();
  if (title.length < 1 || title.length > MAX_TITLE) {
    throw validation(`title 1 ile ${MAX_TITLE} karakter arasında olmalıdır.`);
  }

  const type = raw.type === undefined || raw.type === null ? 'event' : raw.type;
  if (typeof type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(type)) {
    throw validation(`type şunlardan biri olmalıdır: ${EVENT_TYPES.join(', ')}.`);
  }

  const allDayRaw = raw.allDay === undefined || raw.allDay === null ? false : raw.allDay;
  if (typeof allDayRaw !== 'boolean') throw validation('allDay boolean olmalıdır.');
  const allDay = allDayRaw;

  const description = optionalText(raw.description, 'description', MAX_DESCRIPTION);
  const location = optionalText(raw.location, 'location', MAX_LOCATION);

  let courseId: string | null = null;
  if (raw.courseId !== undefined && raw.courseId !== null) {
    if (typeof raw.courseId !== 'string' || raw.courseId === '') {
      throw validation('courseId geçerli bir kurs kimliği veya null olmalıdır.');
    }
    courseId = raw.courseId;
  }

  const hasEnd = raw.end !== undefined && raw.end !== null;
  let start: Date | null;
  let end: Date | null = null;
  if (allDay) {
    start = parseDateOnly(raw.start);
    if (!start) throw validation('Tüm gün etkinlikte start YYYY-MM-DD biçiminde olmalıdır.');
    if (hasEnd) {
      end = parseDateOnly(raw.end);
      if (!end) throw validation('Tüm gün etkinlikte end YYYY-MM-DD biçiminde olmalıdır.');
    } else {
      end = new Date(start.getTime() + DAY_MS);
    }
    if (end.getTime() <= start.getTime()) throw validation('end, start değerinden sonra olmalıdır.');
  } else {
    start = parseDateTime(raw.start);
    if (!start) throw validation('start ofset veya Z içeren ISO tarih-saat olmalıdır.');
    if (hasEnd) {
      end = parseDateTime(raw.end);
      if (!end) throw validation('end ofset veya Z içeren ISO tarih-saat olmalıdır.');
      if (end.getTime() <= start.getTime()) throw validation('end, start değerinden sonra olmalıdır.');
      if (end.getTime() - start.getTime() > MAX_TIMED_DURATION_DAYS * DAY_MS) {
        throw validation(`Etkinlik süresi en fazla ${MAX_TIMED_DURATION_DAYS} gün olabilir.`);
      }
    }
  }

  return { title, description, type: type as EventType, start, end, allDay, location, courseId };
}

export interface StoredEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  courseId: string | null;
  course: { id: string; title: string } | null;
}

function formatBoundary(date: Date, allDay: boolean): string {
  return allDay ? formatDateOnly(date) : date.toISOString();
}

/** Mevcut kaydı PATCH birleşimi için API'nin kullandığı ham biçime çevirir. */
export function toRawInput(event: StoredEvent): Required<RawEventInput> {
  return {
    title: event.title,
    description: event.description,
    type: event.type,
    start: formatBoundary(event.start, event.allDay),
    end: event.end ? formatBoundary(event.end, event.allDay) : null,
    allDay: event.allDay,
    location: event.location,
    courseId: event.courseId,
  };
}

/** ADMIN her etkinliği, aktif rolü INSTRUCTOR olan eğitmen yalnızca atandığı kursun etkinliğini düzenler. */
export function canEditEvent(
  viewer: { role: string },
  courseId: string | null,
  assignedCourseIds: ReadonlySet<string>,
): boolean {
  if (viewer.role === 'ADMIN') return true;
  return viewer.role === 'INSTRUCTOR' && courseId !== null && assignedCourseIds.has(courseId);
}

export function serializeEvent(event: StoredEvent, canEdit: boolean) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    type: event.type,
    start: formatBoundary(event.start, event.allDay),
    end: event.end ? formatBoundary(event.end, event.allDay) : null,
    allDay: event.allDay,
    location: event.location,
    course: event.course ? { id: event.course.id, title: event.course.title } : null,
    canEdit,
  };
}
