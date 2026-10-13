import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { parseDateOnly, parseDateTime, parseRange } from '../lib/calendar.js';

describe('calendar helpers', () => {
  it('parses only real calendar dates', () => {
    expect(parseDateOnly('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('2026-2-3')).toBeNull();
    expect(parseDateOnly(20260101)).toBeNull();
  });

  it('requires an offset on datetimes', () => {
    expect(parseDateTime('2026-10-14T09:00:00Z')).not.toBeNull();
    expect(parseDateTime('2026-10-14T09:00:00+03:00')?.toISOString()).toBe('2026-10-14T06:00:00.000Z');
    expect(parseDateTime('2026-10-14T09:00:00')).toBeNull();
    expect(parseDateTime('2026-10-14')).toBeNull();
    expect(parseDateTime('2026-13-14T09:00:00Z')).toBeNull();
  });

  it('allows exactly 400 days but not more', () => {
    expect(() => parseRange('2026-01-01', '2027-02-05')).not.toThrow(); // 400 gün
    expect(() => parseRange('2026-01-01', '2027-02-06')).toThrow();
  });
});

describe('calendar routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let instructorToken: string;
  let otherInstructorToken: string;
  let studentToken: string;
  let outsiderToken: string;
  let instructorId: string;
  let courseA: string; // öğrenci kayıtlı, eğitmen atanmış
  let courseB: string; // kimse yok

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const RANGE = 'from=2026-10-01&to=2026-11-01';

  function list(token: string, query = RANGE) {
    return app.inject({ method: 'GET', url: `/api/v1/calendar/events?${query}`, headers: auth(token) });
  }
  function post(token: string, payload: unknown) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/calendar/events',
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  }
  function patch(token: string, id: string, payload: unknown) {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/calendar/events/${id}`,
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  }
  function del(token: string, id: string) {
    return app.inject({ method: 'DELETE', url: `/api/v1/calendar/events/${id}`, headers: auth(token) });
  }
  async function seed(data: {
    title: string;
    start: string;
    end?: string | null;
    allDay?: boolean;
    courseId?: string | null;
    type?: string;
  }) {
    return prisma.calendarEvent.create({
      data: {
        title: data.title,
        start: new Date(data.start),
        end: data.end ? new Date(data.end) : null,
        allDay: data.allDay ?? false,
        courseId: data.courseId ?? null,
        type: data.type ?? 'event',
      },
    });
  }
  const titles = (res: { json: () => { events: { title: string }[] } }) => res.json().events.map((e) => e.title);

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.calendarEvent.deleteMany();
    await prisma.courseInstructor.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const makeUser = (email: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') =>
      prisma.user.create({ data: { email, passwordHash: 'x', name: email, role } });
    const admin = await makeUser('admin@example.com', 'ADMIN');
    const instructor = await makeUser('instructor@example.com', 'INSTRUCTOR');
    const otherInstructor = await makeUser('instructor2@example.com', 'INSTRUCTOR');
    const student = await makeUser('student@example.com', 'STUDENT');
    const outsider = await makeUser('outsider@example.com', 'STUDENT');
    instructorId = instructor.id;
    const tokenFor = (userId: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') =>
      signToken({ userId, role, roles: [role] });
    adminToken = tokenFor(admin.id, 'ADMIN');
    instructorToken = tokenFor(instructor.id, 'INSTRUCTOR');
    otherInstructorToken = tokenFor(otherInstructor.id, 'INSTRUCTOR');
    studentToken = tokenFor(student.id, 'STUDENT');
    outsiderToken = tokenFor(outsider.id, 'STUDENT');

    const makeCourse = (title: string) =>
      prisma.course.create({
        data: { title, description: 'Açıklama', category: 'Test', level: 'Başlangıç', status: 'PUBLISHED' },
      });
    courseA = (await makeCourse('Kurs A')).id;
    courseB = (await makeCourse('Kurs B')).id;
    await prisma.enrollment.create({ data: { userId: student.id, courseId: courseA, method: 'OPEN' } });
    await prisma.courseInstructor.create({ data: { courseId: courseA, userId: instructor.id, position: 1 } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET visibility', () => {
    beforeEach(async () => {
      await seed({ title: 'Genel', start: '2026-10-10T09:00:00Z' });
      await seed({ title: 'A etkinliği', start: '2026-10-11T09:00:00Z', courseId: courseA });
      await seed({ title: 'B etkinliği', start: '2026-10-12T09:00:00Z', courseId: courseB });
    });

    it('requires auth', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/v1/calendar/events?${RANGE}` });
      expect(res.statusCode).toBe(401);
    });

    it('student sees general and enrolled-course events only', async () => {
      expect(titles(await list(studentToken))).toEqual(['Genel', 'A etkinliği']);
    });

    it('non-enrolled student sees only general events', async () => {
      expect(titles(await list(outsiderToken))).toEqual(['Genel']);
    });

    it('assigned instructor sees own course, not others', async () => {
      expect(titles(await list(instructorToken))).toEqual(['Genel', 'A etkinliği']);
      expect(titles(await list(otherInstructorToken))).toEqual(['Genel']);
    });

    it('instructor acting as student does not get assigned-course visibility', async () => {
      const asStudent = signToken({ userId: instructorId, role: 'STUDENT', roles: ['STUDENT', 'INSTRUCTOR'] });
      expect(titles(await list(asStudent))).toEqual(['Genel']);
    });

    it('admin sees everything, sorted by start', async () => {
      expect(titles(await list(adminToken))).toEqual(['Genel', 'A etkinliği', 'B etkinliği']);
    });
  });

  describe('GET range filtering', () => {
    it('includes a multi-day all-day event that only partly overlaps the range', async () => {
      await seed({ title: 'Ara tatil', start: '2026-09-28T00:00:00Z', end: '2026-10-03T00:00:00Z', allDay: true });
      expect(titles(await list(adminToken))).toEqual(['Ara tatil']);
    });

    it('excludes an event ending exactly at from, and one starting exactly at to', async () => {
      await seed({ title: 'Biten', start: '2026-09-29T00:00:00Z', end: '2026-10-01T00:00:00Z', allDay: true });
      await seed({ title: 'Başlayan', start: '2026-11-01T00:00:00Z', end: '2026-11-02T00:00:00Z', allDay: true });
      expect(titles(await list(adminToken))).toEqual([]);
    });

    it('treats events without end as points in [from, to)', async () => {
      await seed({ title: 'Tam from', start: '2026-10-01T00:00:00Z' });
      await seed({ title: 'İçeride', start: '2026-10-15T12:00:00Z' });
      await seed({ title: 'Tam to', start: '2026-11-01T00:00:00Z' });
      await seed({ title: 'Önce', start: '2026-09-30T23:59:00Z' });
      expect(titles(await list(adminToken))).toEqual(['Tam from', 'İçeride']);
    });

    it('accepts datetime bounds with offsets', async () => {
      await seed({ title: 'Sabah', start: '2026-10-14T06:00:00Z' });
      const inside = await list(adminToken, 'from=2026-10-14T09:00:00%2B03:00&to=2026-10-14T10:00:00%2B03:00');
      expect(titles(inside)).toEqual(['Sabah']);
      const outside = await list(adminToken, 'from=2026-10-14T09:00:01%2B03:00&to=2026-10-14T10:00:00%2B03:00');
      expect(titles(outside)).toEqual([]);
    });
  });

  describe('GET range validation', () => {
    it.each([
      ['missing both', ''],
      ['missing to', 'from=2026-10-01'],
      ['missing from', 'to=2026-10-01'],
      ['to equals from', 'from=2026-10-01&to=2026-10-01'],
      ['to before from', 'from=2026-10-05&to=2026-10-01'],
      ['more than 400 days', 'from=2026-01-01&to=2027-02-06'],
      ['bad from', 'from=yarin&to=2026-10-01'],
      ['bad to', 'from=2026-10-01&to=2026-02-30'],
      ['datetime without offset', 'from=2026-10-01T00:00:00&to=2026-10-02T00:00:00'],
    ])('rejects %s', async (_name, query) => {
      const res = await list(adminToken, query);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts exactly 400 days', async () => {
      expect((await list(adminToken, 'from=2026-01-01&to=2027-02-05')).statusCode).toBe(200);
    });
  });

  describe('POST validation', () => {
    const valid = { title: 'Vize', type: 'exam', start: '2026-10-20T09:00:00Z' };

    it.each([
      ['missing title', { start: valid.start }],
      ['empty title', { ...valid, title: '   ' }],
      ['non-string title', { ...valid, title: 5 }],
      ['title too long', { ...valid, title: 'a'.repeat(201) }],
      ['bad type', { ...valid, type: 'party' }],
      ['missing start', { title: 'x' }],
      ['bad start', { ...valid, start: 'yarın' }],
      ['start without offset', { ...valid, start: '2026-10-20T09:00:00' }],
      ['start date-only for timed', { ...valid, start: '2026-10-20' }],
      ['end equals start', { ...valid, end: valid.start }],
      ['end before start', { ...valid, end: '2026-10-20T08:00:00Z' }],
      ['bad end', { ...valid, end: 'later' }],
      ['allDay with datetime start', { ...valid, allDay: true }],
      ['allDay with datetime end', { ...valid, allDay: true, start: '2026-10-20', end: '2026-10-21T00:00:00Z' }],
      ['allDay end equals start', { ...valid, allDay: true, start: '2026-10-20', end: '2026-10-20' }],
      ['allDay impossible date', { ...valid, allDay: true, start: '2026-02-30' }],
      ['allDay non-boolean', { ...valid, allDay: 'yes' }],
      ['duration over 31 days', { ...valid, end: '2026-11-21T09:00:01Z' }],
      ['location too long', { ...valid, location: 'x'.repeat(201) }],
      ['description too long', { ...valid, description: 'x'.repeat(2001) }],
      ['non-string description', { ...valid, description: 3 }],
    ])('rejects %s', async (_name, payload) => {
      const res = await post(adminToken, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts exactly 31 days and boundary lengths', async () => {
      const res = await post(adminToken, {
        ...valid,
        title: 'a'.repeat(200),
        end: '2026-11-20T09:00:00Z',
        location: 'x'.repeat(200),
        description: 'y'.repeat(2000),
      });
      expect(res.statusCode).toBe(201);
    });

    it('defaults type to event, trims, and blanks empty optionals to null', async () => {
      const res = await post(adminToken, { title: '  Toplantı  ', start: valid.start, location: '  ', description: null });
      expect(res.statusCode).toBe(201);
      const { event } = res.json();
      expect(event).toMatchObject({ title: 'Toplantı', type: 'event', location: null, description: null, end: null });
    });

    it('defaults all-day end to start + 1 day', async () => {
      const res = await post(adminToken, { title: 'Tatil', type: 'holiday', allDay: true, start: '2026-10-29' });
      expect(res.statusCode).toBe(201);
      expect(res.json().event).toMatchObject({ start: '2026-10-29', end: '2026-10-30', allDay: true });
      const row = await prisma.calendarEvent.findFirstOrThrow();
      expect(row.start.toISOString()).toBe('2026-10-29T00:00:00.000Z');
      expect(row.end?.toISOString()).toBe('2026-10-30T00:00:00.000Z');
    });

    it('rejects a non-object body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/calendar/events',
        headers: auth(adminToken),
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for an unknown course', async () => {
      const res = await post(adminToken, { ...valid, courseId: 'nope' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toEqual({ code: 'NOT_FOUND', message: 'Kurs bulunamadı.' });
    });
  });

  describe('POST permissions', () => {
    const base = { title: 'Etkinlik', start: '2026-10-20T09:00:00Z' };

    it('requires auth', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/calendar/events', payload: base });
      expect(res.statusCode).toBe(401);
    });

    it('forbids students, even for their enrolled course', async () => {
      expect((await post(studentToken, base)).statusCode).toBe(403);
      expect((await post(studentToken, { ...base, courseId: courseA })).statusCode).toBe(403);
    });

    it('forbids instructors from general events', async () => {
      expect((await post(instructorToken, base)).statusCode).toBe(403);
    });

    it('forbids instructors on unassigned courses', async () => {
      expect((await post(instructorToken, { ...base, courseId: courseB })).statusCode).toBe(403);
      expect((await post(otherInstructorToken, { ...base, courseId: courseA })).statusCode).toBe(403);
    });

    it('lets an assigned instructor create a course event and records createdBy', async () => {
      const res = await post(instructorToken, { ...base, courseId: courseA });
      expect(res.statusCode).toBe(201);
      expect(res.json().event.course).toEqual({ id: courseA, title: 'Kurs A' });
      const row = await prisma.calendarEvent.findFirstOrThrow();
      expect(row.createdById).toBe(instructorId);
    });

    it('lets an admin create general and any-course events', async () => {
      expect((await post(adminToken, base)).statusCode).toBe(201);
      expect((await post(adminToken, { ...base, courseId: courseB })).statusCode).toBe(201);
    });
  });

  describe('serialization', () => {
    it('returns date-only strings for all-day, ISO for timed, and the full shape', async () => {
      await seed({ title: 'Tatil', start: '2026-10-29T00:00:00Z', end: '2026-10-31T00:00:00Z', allDay: true });
      await prisma.calendarEvent.create({
        data: {
          title: 'Ders',
          type: 'lecture',
          description: 'Giriş',
          location: 'A-101',
          start: new Date('2026-10-14T09:00:00+03:00'),
          end: new Date('2026-10-14T10:30:00+03:00'),
          courseId: courseA,
        },
      });
      const { events } = (await list(adminToken)).json();
      expect(events).toEqual([
        {
          id: expect.any(String),
          title: 'Ders',
          description: 'Giriş',
          type: 'lecture',
          start: '2026-10-14T06:00:00.000Z',
          end: '2026-10-14T07:30:00.000Z',
          allDay: false,
          location: 'A-101',
          course: { id: courseA, title: 'Kurs A' },
          canEdit: true,
        },
        {
          id: expect.any(String),
          title: 'Tatil',
          description: null,
          type: 'event',
          start: '2026-10-29',
          end: '2026-10-31',
          allDay: true,
          location: null,
          course: null,
          canEdit: true,
        },
      ]);
    });

    it('computes canEdit per viewer', async () => {
      await seed({ title: 'Genel', start: '2026-10-10T09:00:00Z' });
      await seed({ title: 'A', start: '2026-10-11T09:00:00Z', courseId: courseA });
      const flags = async (token: string) =>
        Object.fromEntries((await list(token)).json().events.map((e: { title: string; canEdit: boolean }) => [e.title, e.canEdit]));
      expect(await flags(adminToken)).toEqual({ Genel: true, A: true });
      expect(await flags(instructorToken)).toEqual({ Genel: false, A: true });
      expect(await flags(studentToken)).toEqual({ Genel: false, A: false });
      const asStudent = signToken({ userId: instructorId, role: 'STUDENT', roles: ['STUDENT', 'INSTRUCTOR'] });
      await prisma.enrollment.create({ data: { userId: instructorId, courseId: courseA, method: 'OPEN' } });
      expect(await flags(asStudent)).toEqual({ Genel: false, A: false });
    });
  });

  describe('PATCH', () => {
    it('merges partial updates and keeps other fields', async () => {
      const created = (
        await post(adminToken, {
          title: 'Vize',
          type: 'exam',
          start: '2026-10-20T09:00:00Z',
          end: '2026-10-20T11:00:00Z',
          location: 'B-2',
          courseId: courseA,
        })
      ).json().event;
      const res = await patch(instructorToken, created.id, { title: 'Final', location: null });
      expect(res.statusCode).toBe(200);
      expect(res.json().event).toMatchObject({
        title: 'Final',
        type: 'exam',
        location: null,
        start: '2026-10-20T09:00:00.000Z',
        end: '2026-10-20T11:00:00.000Z',
        course: { id: courseA, title: 'Kurs A' },
        canEdit: true,
      });
    });

    it('validates the merged result (new start after existing end)', async () => {
      const created = (
        await post(adminToken, { title: 'x', start: '2026-10-20T09:00:00Z', end: '2026-10-20T10:00:00Z' })
      ).json().event;
      const res = await patch(adminToken, created.id, { start: '2026-10-21T09:00:00Z' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects an empty patch and invalid values', async () => {
      const created = (await post(adminToken, { title: 'x', start: '2026-10-20T09:00:00Z' })).json().event;
      expect((await patch(adminToken, created.id, {})).statusCode).toBe(400);
      expect((await patch(adminToken, created.id, { title: '' })).statusCode).toBe(400);
      expect((await patch(adminToken, created.id, { type: 'nope' })).statusCode).toBe(400);
    });

    it('returns 404 for a missing event and 403 for a student', async () => {
      expect((await patch(adminToken, 'missing', { title: 'x' })).statusCode).toBe(404);
      expect((await patch(adminToken, 'missing', { title: 'x' })).json().error.message).toBe('Etkinlik bulunamadı.');
      const created = (await post(adminToken, { title: 'x', start: '2026-10-20T09:00:00Z', courseId: courseA })).json().event;
      expect((await patch(studentToken, created.id, { title: 'y' })).statusCode).toBe(403);
    });

    it('forbids an instructor editing a general event or another course event', async () => {
      const general = (await post(adminToken, { title: 'g', start: '2026-10-20T09:00:00Z' })).json().event;
      const other = (await post(adminToken, { title: 'b', start: '2026-10-20T09:00:00Z', courseId: courseB })).json().event;
      expect((await patch(instructorToken, general.id, { title: 'z' })).statusCode).toBe(403);
      expect((await patch(instructorToken, other.id, { title: 'z' })).statusCode).toBe(403);
    });

    it('checks the target when moving to another course', async () => {
      const mine = (await post(instructorToken, { title: 'm', start: '2026-10-20T09:00:00Z', courseId: courseA })).json().event;
      // atanmadığı kursa taşıma
      expect((await patch(instructorToken, mine.id, { courseId: courseB })).statusCode).toBe(403);
      // genel etkinliğe çevirme
      expect((await patch(instructorToken, mine.id, { courseId: null })).statusCode).toBe(403);
      // var olmayan kurs
      expect((await patch(instructorToken, mine.id, { courseId: 'nope' })).statusCode).toBe(404);
      // değişmedi
      expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: mine.id } })).courseId).toBe(courseA);
      // admin taşıyabilir; ardından eğitmen artık düzenleyemez
      expect((await patch(adminToken, mine.id, { courseId: courseB })).json().event.course.id).toBe(courseB);
      expect((await patch(instructorToken, mine.id, { title: 'q' })).statusCode).toBe(403);
      expect((await patch(adminToken, mine.id, { courseId: null })).json().event.course).toBeNull();
    });

    it('requires a new start when toggling allDay', async () => {
      const timed = (
        await post(adminToken, { title: 't', start: '2026-10-20T09:00:00Z', end: '2026-10-20T10:00:00Z' })
      ).json().event;
      const without = await patch(adminToken, timed.id, { allDay: true });
      expect(without.statusCode).toBe(400);
      expect(without.json().error.message).toContain('allDay');
      expect((await patch(adminToken, timed.id, { allDay: true, start: '2026-10-20T09:00:00Z' })).statusCode).toBe(400);

      const toAllDay = await patch(adminToken, timed.id, { allDay: true, start: '2026-10-20' });
      expect(toAllDay.statusCode).toBe(200);
      expect(toAllDay.json().event).toMatchObject({ allDay: true, start: '2026-10-20', end: '2026-10-21' });

      const back = await patch(adminToken, timed.id, { allDay: false, start: '2026-10-22T08:00:00Z', end: '2026-10-22T09:00:00Z' });
      expect(back.statusCode).toBe(200);
      expect(back.json().event).toMatchObject({
        allDay: false,
        start: '2026-10-22T08:00:00.000Z',
        end: '2026-10-22T09:00:00.000Z',
      });
    });

    it('rejects date-only start on a timed event without toggling', async () => {
      const timed = (await post(adminToken, { title: 't', start: '2026-10-20T09:00:00Z' })).json().event;
      expect((await patch(adminToken, timed.id, { start: '2026-10-21' })).statusCode).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('deletes with permission and 404s afterwards', async () => {
      const created = (await post(instructorToken, { title: 'x', start: '2026-10-20T09:00:00Z', courseId: courseA })).json().event;
      expect((await del(studentToken, created.id)).statusCode).toBe(403);
      expect((await del(otherInstructorToken, created.id)).statusCode).toBe(403);
      const res = await del(instructorToken, created.id);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ deleted: true });
      const again = await del(instructorToken, created.id);
      expect(again.statusCode).toBe(404);
      expect(again.json().error.message).toBe('Etkinlik bulunamadı.');
    });

    it('lets only admins delete general events', async () => {
      const general = (await post(adminToken, { title: 'g', start: '2026-10-20T09:00:00Z' })).json().event;
      expect((await del(instructorToken, general.id)).statusCode).toBe(403);
      expect((await del(adminToken, general.id)).statusCode).toBe(200);
    });

    it('requires auth', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/v1/calendar/events/x' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('referential behavior', () => {
    it('cascades events when the course is deleted', async () => {
      await seed({ title: 'A', start: '2026-10-11T09:00:00Z', courseId: courseA });
      await seed({ title: 'Genel', start: '2026-10-11T09:00:00Z' });
      await prisma.course.delete({ where: { id: courseA } });
      const rows = await prisma.calendarEvent.findMany();
      expect(rows.map((r) => r.title)).toEqual(['Genel']);
    });

    it('sets createdById to null when the creator is deleted', async () => {
      const created = (await post(adminToken, { title: 'g', start: '2026-10-20T09:00:00Z' })).json().event;
      const before = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: created.id } });
      expect(before.createdById).not.toBeNull();
      await prisma.user.delete({ where: { id: before.createdById! } });
      const after = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: created.id } });
      expect(after.createdById).toBeNull();
    });
  });
});
