import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { addDays, categoryFor, computeStreak, dayKey, MAX_HEARTBEAT_SECONDS } from '../lib/activity.js';

describe('activity helpers', () => {
  it('derives the calendar day in the configured time zone', () => {
    // 22:30 UTC, İstanbul'da (UTC+3) ertesi günün 01:30'u.
    expect(dayKey(new Date('2026-10-13T22:30:00Z'), 'Europe/Istanbul')).toBe('2026-10-14');
    expect(dayKey(new Date('2026-10-13T20:59:00Z'), 'Europe/Istanbul')).toBe('2026-10-13');
    expect(dayKey(new Date('2026-10-13T22:30:00Z'), 'UTC')).toBe('2026-10-13');
  });

  it('does calendar arithmetic across month and year boundaries', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('maps content types to categories', () => {
    expect(categoryFor('VIDEO_YOUTUBE')).toBe('VIDEO');
    expect(categoryFor('QUIZ')).toBe('QUIZ');
    expect(categoryFor('DOCUMENT')).toBe('READING');
    expect(categoryFor('LINK')).toBe('READING');
    expect(categoryFor('TEXT')).toBe('READING');
  });

  it('counts the streak back from today, or from yesterday when today is empty', () => {
    const today = '2026-10-13';
    expect(computeStreak(new Set(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-09']), today)).toBe(3);
    expect(computeStreak(new Set(['2026-10-12', '2026-10-11']), today)).toBe(2);
    expect(computeStreak(new Set(['2026-10-11']), today)).toBe(0);
    expect(computeStreak(new Set(), today)).toBe(0);
  });
});

describe('activity routes', () => {
  let app: FastifyInstance;
  let studentId: string;
  let otherId: string;
  let studentToken: string;
  let otherToken: string;
  let outsiderToken: string;
  let courseId: string;
  let secondCourseId: string;
  let videoLessonId: string;
  let quizLessonId: string;
  let documentLessonId: string;
  let draftLessonId: string;
  let secondCourseLessonId: string;

  const today = () => dayKey(new Date());
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  function heartbeat(payload: unknown, token = studentToken) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/users/me/activity',
      headers: auth(token),
      payload: payload as Record<string, unknown>,
    });
  }

  function report(query = '', token = studentToken) {
    return app.inject({ method: 'GET', url: `/api/v1/users/me/activity${query}`, headers: auth(token) });
  }

  async function createCourseWithLessons(contentTypes: { type: string; status?: string }[]) {
    const course = await prisma.course.create({
      data: { title: 'Kurs', description: 'Açıklama', category: 'Test', level: 'Başlangıç', status: 'PUBLISHED' },
    });
    const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Modül', order: 1 } });
    const lessons = [];
    for (const [index, item] of contentTypes.entries()) {
      lessons.push(
        await prisma.lesson.create({
          data: {
            moduleId: mod.id,
            title: `Ders ${index + 1}`,
            order: index + 1,
            status: item.status ?? 'PUBLISHED',
            contentType: item.type,
          },
        }),
      );
    }
    return { courseId: course.id, lessonIds: lessons.map((lesson) => lesson.id) };
  }

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.studyActivity.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.lessonProgress.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const makeUser = (email: string, name: string) =>
      prisma.user.create({ data: { email, passwordHash: 'x', name, role: 'STUDENT' } });
    const student = await makeUser('student@example.com', 'Öğrenci');
    const other = await makeUser('other@example.com', 'Diğer');
    const outsider = await makeUser('outsider@example.com', 'Dışarıdan');
    studentId = student.id;
    otherId = other.id;
    const tokenFor = (userId: string) => signToken({ userId, role: 'STUDENT', roles: ['STUDENT'] });
    studentToken = tokenFor(student.id);
    otherToken = tokenFor(other.id);
    outsiderToken = tokenFor(outsider.id);

    const first = await createCourseWithLessons([
      { type: 'VIDEO_YOUTUBE' },
      { type: 'QUIZ' },
      { type: 'DOCUMENT' },
      { type: 'VIDEO_YOUTUBE', status: 'DRAFT' },
    ]);
    courseId = first.courseId;
    [videoLessonId, quizLessonId, documentLessonId, draftLessonId] = first.lessonIds;

    const second = await createCourseWithLessons([{ type: 'VIDEO_YOUTUBE' }]);
    secondCourseId = second.courseId;
    [secondCourseLessonId] = second.lessonIds;

    for (const userId of [studentId, otherId]) {
      for (const id of [courseId, secondCourseId]) {
        await prisma.enrollment.create({ data: { userId, courseId: id, method: 'OPEN' } });
      }
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /users/me/activity', () => {
    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users/me/activity',
        payload: { lessonId: videoLessonId, seconds: 30 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('validates lessonId and seconds', async () => {
      for (const payload of [
        { seconds: 30 },
        { lessonId: '', seconds: 30 },
        { lessonId: videoLessonId },
        { lessonId: videoLessonId, seconds: 0 },
        { lessonId: videoLessonId, seconds: -5 },
        { lessonId: videoLessonId, seconds: 1.5 },
        { lessonId: videoLessonId, seconds: '30' },
      ]) {
        const response = await heartbeat(payload);
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('404s for missing or draft lessons', async () => {
      expect((await heartbeat({ lessonId: 'yok', seconds: 30 })).statusCode).toBe(404);
      const draft = await heartbeat({ lessonId: draftLessonId, seconds: 30 });
      expect(draft.statusCode).toBe(404);
      expect(draft.json().error.code).toBe('NOT_FOUND');
    });

    it('403s when the user is not enrolled', async () => {
      const response = await heartbeat({ lessonId: videoLessonId, seconds: 30 }, outsiderToken);
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('NOT_ENROLLED');
      expect(await prisma.studyActivity.count()).toBe(0);
    });

    it('accumulates repeated heartbeats into a single daily row', async () => {
      expect((await heartbeat({ lessonId: videoLessonId, seconds: 60 })).json()).toEqual({ recorded: 60 });
      await heartbeat({ lessonId: videoLessonId, seconds: 45 });

      const rows = await prisma.studyActivity.findMany({ where: { userId: studentId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ courseId, day: today(), category: 'VIDEO', seconds: 105 });
    });

    it('clamps a single heartbeat to the maximum', async () => {
      const response = await heartbeat({ lessonId: videoLessonId, seconds: 5000 });
      expect(response.json()).toEqual({ recorded: MAX_HEARTBEAT_SECONDS });
      const row = await prisma.studyActivity.findFirstOrThrow({ where: { userId: studentId } });
      expect(row.seconds).toBe(MAX_HEARTBEAT_SECONDS);
    });

    it('splits rows by category and course, derived on the server', async () => {
      await heartbeat({ lessonId: videoLessonId, seconds: 10 });
      await heartbeat({ lessonId: quizLessonId, seconds: 20 });
      await heartbeat({ lessonId: documentLessonId, seconds: 30 });
      await heartbeat({ lessonId: secondCourseLessonId, seconds: 40 });

      const rows = await prisma.studyActivity.findMany({
        where: { userId: studentId },
        orderBy: { seconds: 'asc' },
      });
      expect(rows.map((row) => [row.courseId, row.category, row.seconds])).toEqual([
        [courseId, 'VIDEO', 10],
        [courseId, 'QUIZ', 20],
        [courseId, 'READING', 30],
        [secondCourseId, 'VIDEO', 40],
      ]);
    });

    it('handles concurrent first heartbeats without losing time', async () => {
      await Promise.all([
        heartbeat({ lessonId: videoLessonId, seconds: 30 }),
        heartbeat({ lessonId: videoLessonId, seconds: 30 }),
        heartbeat({ lessonId: videoLessonId, seconds: 30 }),
      ]);
      const rows = await prisma.studyActivity.findMany({ where: { userId: studentId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].seconds).toBe(90);
    });

    it('is removed together with the course', async () => {
      await heartbeat({ lessonId: videoLessonId, seconds: 30 });
      await prisma.course.delete({ where: { id: courseId } });
      expect(await prisma.studyActivity.count()).toBe(0);
    });
  });

  describe('GET /users/me/activity', () => {
    async function seed(userId: string, day: string, category: string, seconds: number, course = courseId) {
      await prisma.studyActivity.create({ data: { userId, courseId: course, day, category, seconds } });
    }

    it('requires authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/users/me/activity' });
      expect(response.statusCode).toBe(401);
    });

    it('validates the days parameter', async () => {
      for (const query of ['?days=0', '?days=91', '?days=abc', '?days=2.5', '?days=-3']) {
        const response = await report(query);
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns 7 zero-filled days ending today by default', async () => {
      const body = (await report()).json();
      expect(body.timezone).toBe('Europe/Istanbul');
      expect(body.today).toBe(today());
      expect(body.days).toHaveLength(7);
      expect(body.days[0].date).toBe(addDays(today(), -6));
      expect(body.days[6]).toEqual({
        date: today(),
        videoSeconds: 0,
        quizSeconds: 0,
        readingSeconds: 0,
        totalSeconds: 0,
      });
      expect(body.totals).toEqual({ todaySeconds: 0, rangeSeconds: 0, monthSeconds: 0 });
      expect(body.streakDays).toBe(0);
    });

    it('aggregates by day and category across courses', async () => {
      const t = today();
      await seed(studentId, t, 'VIDEO', 600);
      await seed(studentId, t, 'VIDEO', 300, secondCourseId);
      await seed(studentId, t, 'QUIZ', 120);
      await seed(studentId, addDays(t, -2), 'READING', 240);
      await seed(studentId, addDays(t, -7), 'VIDEO', 999); // aralığın dışında

      const body = (await report()).json();
      expect(body.days[6]).toEqual({
        date: t,
        videoSeconds: 900,
        quizSeconds: 120,
        readingSeconds: 0,
        totalSeconds: 1020,
      });
      expect(body.days[4]).toMatchObject({ date: addDays(t, -2), readingSeconds: 240, totalSeconds: 240 });
      expect(body.totals.todaySeconds).toBe(1020);
      expect(body.totals.rangeSeconds).toBe(1260);
    });

    it('supports a custom range length', async () => {
      await seed(studentId, addDays(today(), -20), 'VIDEO', 100);
      const body = (await report('?days=30')).json();
      expect(body.days).toHaveLength(30);
      expect(body.totals.rangeSeconds).toBe(100);
    });

    it('totals the current calendar month', async () => {
      const t = today();
      const monthStart = `${t.slice(0, 8)}01`;
      await seed(studentId, monthStart, 'VIDEO', 100);
      await seed(studentId, t, 'QUIZ', 50, secondCourseId);
      await seed(studentId, addDays(monthStart, -1), 'VIDEO', 777); // önceki ay
      const body = (await report()).json();
      // monthStart bugünse iki kayıt aynı güne düşer; toplam yine 150.
      expect(body.totals.monthSeconds).toBe(150);
    });

    it('computes the streak from consecutive active days', async () => {
      const t = today();
      await seed(studentId, t, 'VIDEO', 60);
      await seed(studentId, addDays(t, -1), 'QUIZ', 60);
      await seed(studentId, addDays(t, -2), 'READING', 60);
      await seed(studentId, addDays(t, -4), 'VIDEO', 60);
      expect((await report()).json().streakDays).toBe(3);
    });

    it('only reports the caller own activity', async () => {
      await seed(otherId, today(), 'VIDEO', 500);
      const mine = (await report()).json();
      expect(mine.totals.todaySeconds).toBe(0);
      const theirs = (await report('', otherToken)).json();
      expect(theirs.totals.todaySeconds).toBe(500);
    });

    it('reflects recorded heartbeats end to end', async () => {
      await heartbeat({ lessonId: videoLessonId, seconds: 90 });
      await heartbeat({ lessonId: quizLessonId, seconds: 30 });
      const body = (await report()).json();
      expect(body.days[6]).toMatchObject({ videoSeconds: 90, quizSeconds: 30, totalSeconds: 120 });
      expect(body.streakDays).toBe(1);
    });
  });
});
