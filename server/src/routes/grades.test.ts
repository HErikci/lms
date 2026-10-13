import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import {
  buildRoster,
  computeGradeSummary,
  isValidScore,
  letterGradeFor,
  levelFor,
  roundedMean,
  sortNewestFirst,
} from '../lib/grades.js';

describe('grade helpers', () => {
  it('accepts only integers between 0 and 100', () => {
    for (const ok of [0, 1, 50, 99, 100]) expect(isValidScore(ok)).toBe(true);
    for (const bad of [-1, 101, 50.5, NaN, Infinity, '80', '', null, undefined, true, [], {}]) {
      expect(isValidScore(bad)).toBe(false);
    }
  });

  it('maps the average to a letter grade at every threshold', () => {
    const cases: [number, string][] = [
      [100, 'AA'],
      [90, 'AA'],
      [89, 'BA'],
      [85, 'BA'],
      [84, 'BB'],
      [80, 'BB'],
      [79, 'CB'],
      [75, 'CB'],
      [74, 'CC'],
      [70, 'CC'],
      [69, 'DC'],
      [65, 'DC'],
      [64, 'DD'],
      [60, 'DD'],
      [59, 'FD'],
      [50, 'FD'],
      [49, 'FF'],
      [0, 'FF'],
    ];
    for (const [average, letter] of cases) {
      expect(letterGradeFor(average), `average ${average}`).toBe(letter);
    }
  });

  it('maps the average to a level at every threshold', () => {
    const cases: [number, string][] = [
      [100, 'Yüksek'],
      [85, 'Yüksek'],
      [84, 'İyi'],
      [70, 'İyi'],
      [69, 'Orta'],
      [60, 'Orta'],
      [59, 'Düşük'],
      [0, 'Düşük'],
    ];
    for (const [average, level] of cases) {
      expect(levelFor(average), `average ${average}`).toBe(level);
    }
  });

  it('rounds the mean and returns null for an empty list', () => {
    expect(roundedMean([])).toBeNull();
    expect(roundedMean([80])).toBe(80);
    expect(roundedMean([90, 81])).toBe(86); // 85.5 yukarı yuvarlanır
    expect(roundedMean([70, 71, 71])).toBe(71); // 70.67
  });

  it('summarises an empty list as nulls and a zero count', () => {
    expect(computeGradeSummary([])).toEqual({
      averageScore: null,
      letterGrade: null,
      level: null,
      gradeCount: 0,
      lastScore: null,
      trend: null,
    });
  });

  it('has no trend for a single grade', () => {
    expect(computeGradeSummary([77])).toEqual({
      averageScore: 77,
      letterGrade: 'CB',
      level: 'İyi',
      gradeCount: 1,
      lastScore: 77,
      trend: null,
    });
  });

  it('computes the trend against the rounded mean of the other grades (newest first)', () => {
    expect(computeGradeSummary([80, 60]).trend).toBe(20);
    expect(computeGradeSummary([50, 60]).trend).toBe(-10);
    expect(computeGradeSummary([70, 70]).trend).toBe(0);
    expect(computeGradeSummary([90, 80, 70]).trend).toBe(15);
    // diğerlerinin ortalaması 75.5 -> 76
    expect(computeGradeSummary([90, 76, 75]).trend).toBe(14);
    expect(computeGradeSummary([60, 90, 80, 70]).trend).toBe(-20);
  });

  it('derives letter grade and level from the rounded average', () => {
    const summary = computeGradeSummary([90, 81]);
    expect(summary).toMatchObject({ averageScore: 86, letterGrade: 'BA', level: 'Yüksek', gradeCount: 2 });
  });

  it('sorts newest first, then by Turkish title, without mutating the input', () => {
    const t = (iso: string) => new Date(iso);
    const entries = [
      { lessonId: '1', lessonTitle: 'Quiz Ç', gradedAt: t('2026-10-10T10:00:00Z') },
      { lessonId: '2', lessonTitle: 'Quiz B', gradedAt: t('2026-10-10T10:00:00Z') },
      { lessonId: '3', lessonTitle: 'Quiz A', gradedAt: t('2026-10-10T10:00:00Z') },
      { lessonId: '4', lessonTitle: 'Quiz Z', gradedAt: t('2026-10-12T10:00:00Z') },
      { lessonId: '5', lessonTitle: 'Quiz A', gradedAt: t('2026-10-01T10:00:00Z') },
    ];
    const snapshot = [...entries];
    expect(sortNewestFirst(entries).map((entry) => entry.lessonId)).toEqual(['4', '3', '2', '1', '5']);
    expect(entries).toEqual(snapshot);
  });

  it('builds a roster with nulls for ungraded students, sorted by Turkish name', () => {
    const students = [
      { id: 'z', name: 'Zeynep', email: 'z@x.com', avatarUrl: null },
      { id: 'c', name: 'Çağla', email: 'c@x.com', avatarUrl: 'https://img/c' },
      { id: 'a', name: 'Ahmet', email: 'a@x.com', avatarUrl: null },
    ];
    const gradedAt = new Date('2026-10-13T10:00:00Z');
    const roster = buildRoster(students, [
      { userId: 'c', score: 88, gradedAt },
      { userId: 'ghost', score: 10, gradedAt }, // kayıtlı olmayan kullanıcının notu listeye girmez
    ]);
    expect(roster).toEqual([
      { student: students[2], score: null, gradedAt: null },
      { student: students[1], score: 88, gradedAt: '2026-10-13T10:00:00.000Z' },
      { student: students[0], score: null, gradedAt: null },
    ]);
  });
});

type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
interface TestUser {
  id: string;
  token: string;
}

describe('quiz grade routes', () => {
  let app: FastifyInstance;
  let admin: TestUser;
  let instructor: TestUser; // A kursuna atanmış
  let otherInstructor: TestUser; // yalnızca B kursuna atanmış
  let roleSwitched: TestUser; // A kursuna atanmış ama aktif rolü STUDENT
  let student: TestUser; // A kursuna kayıtlı
  let student2: TestUser; // A kursuna kayıtlı
  let courseBStudent: TestUser; // yalnızca B kursuna kayıtlı
  let outsider: TestUser; // hiçbir kursa kayıtlı değil
  let courseId: string;
  let courseBId: string;
  let moduleId: string;
  let moduleBId: string;
  let quizId: string;
  let draftQuizId: string;
  let docId: string;
  let courseBQuizId: string;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function makeUser(email: string, name: string, role: Role, roles: string = role): Promise<TestUser> {
    const user = await prisma.user.create({ data: { email, passwordHash: 'x', name, role, roles } });
    return { id: user.id, token: signToken({ userId: user.id, role, roles: roles.split(',') as Role[] }) };
  }

  const enroll = (userId: string, course = courseId) =>
    prisma.enrollment.create({ data: { userId, courseId: course, method: 'OPEN' } });

  const makeQuiz = (title: string, mod = moduleId, status = 'PUBLISHED') =>
    prisma.lesson.create({ data: { moduleId: mod, title, order: 1, status, contentType: 'QUIZ' } });

  function list(lessonId: string, token?: string) {
    return app.inject({
      method: 'GET',
      url: `/api/v1/lessons/${lessonId}/grades`,
      headers: token ? auth(token) : {},
    });
  }

  function put(lessonId: string, userId: string, payload?: unknown, token?: string) {
    return app.inject({
      method: 'PUT',
      url: `/api/v1/lessons/${lessonId}/grades/${userId}`,
      headers: token ? auth(token) : {},
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  }

  function remove(lessonId: string, userId: string, token?: string) {
    return app.inject({
      method: 'DELETE',
      url: `/api/v1/lessons/${lessonId}/grades/${userId}`,
      headers: token ? auth(token) : {},
    });
  }

  function myGrades(token?: string) {
    return app.inject({ method: 'GET', url: '/api/v1/users/me/grades', headers: token ? auth(token) : {} });
  }

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.quizGrade.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.courseInstructor.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    admin = await makeUser('admin@example.com', 'Yönetici', 'ADMIN');
    instructor = await makeUser('ins@example.com', 'Eğitmen', 'INSTRUCTOR');
    otherInstructor = await makeUser('ins2@example.com', 'Başka Eğitmen', 'INSTRUCTOR');
    roleSwitched = await makeUser('switched@example.com', 'Rol Değiştiren', 'STUDENT', 'STUDENT,INSTRUCTOR');
    student = await makeUser('s1@example.com', 'Ahmet Kaya', 'STUDENT');
    student2 = await makeUser('s2@example.com', 'Zeynep Yıldız', 'STUDENT');
    courseBStudent = await makeUser('sb@example.com', 'Burak Öztürk', 'STUDENT');
    outsider = await makeUser('out@example.com', 'Kimse', 'STUDENT');

    const makeCourse = (title: string) =>
      prisma.course.create({
        data: { title, description: 'Açıklama', category: 'Test', level: 'Başlangıç', status: 'PUBLISHED' },
      });
    const courseA = await makeCourse('Kurs A');
    const courseB = await makeCourse('Kurs B');
    courseId = courseA.id;
    courseBId = courseB.id;
    moduleId = (await prisma.module.create({ data: { courseId, title: 'Modül A', order: 1 } })).id;
    moduleBId = (await prisma.module.create({ data: { courseId: courseBId, title: 'Modül B', order: 1 } })).id;

    quizId = (await makeQuiz('Quiz 1')).id;
    draftQuizId = (await makeQuiz('Taslak Quiz', moduleId, 'DRAFT')).id;
    docId = (
      await prisma.lesson.create({
        data: { moduleId, title: 'Doküman', order: 2, status: 'PUBLISHED', contentType: 'DOCUMENT' },
      })
    ).id;
    courseBQuizId = (await makeQuiz('B Quiz', moduleBId)).id;

    await prisma.courseInstructor.create({ data: { courseId, userId: instructor.id, position: 1 } });
    await prisma.courseInstructor.create({ data: { courseId, userId: roleSwitched.id, position: 2 } });
    await prisma.courseInstructor.create({ data: { courseId: courseBId, userId: otherInstructor.id, position: 1 } });
    await enroll(student.id);
    await enroll(student2.id);
    await enroll(courseBStudent.id, courseBId);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('authorization', () => {
    const endpoints: [string, (token?: string) => ReturnType<typeof list>][] = [
      ['GET list', (token) => list(quizId, token)],
      ['PUT grade', (token) => put(quizId, student.id, { score: 80 }, token)],
      ['DELETE grade', (token) => remove(quizId, student.id, token)],
    ];

    for (const [name, call] of endpoints) {
      it(`${name}: 401 without a token`, async () => {
        const response = await call();
        expect(response.statusCode).toBe(401);
        expect(response.json().error.code).toBe('UNAUTHORIZED');
      });

      it(`${name}: 403 for students, unassigned instructors and role-switched instructors`, async () => {
        for (const caller of [student, courseBStudent, outsider, otherInstructor, roleSwitched]) {
          const response = await call(caller.token);
          expect(response.statusCode).toBe(403);
          expect(response.json().error.code).toBe('FORBIDDEN');
        }
        expect(await prisma.quizGrade.count()).toBe(0);
      });

      it(`${name}: 404 for a missing lesson`, async () => {
        const url = name.startsWith('GET')
          ? '/api/v1/lessons/yok/grades'
          : `/api/v1/lessons/yok/grades/${student.id}`;
        const method = name.startsWith('GET') ? 'GET' : name.startsWith('PUT') ? 'PUT' : 'DELETE';
        const response = await app.inject({
          method,
          url,
          headers: auth(admin.token),
          ...(method === 'PUT' ? { payload: { score: 80 } } : {}),
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().error).toEqual({ code: 'NOT_FOUND', message: 'Ders bulunamadı.' });
      });

      it(`${name}: 400 NOT_A_QUIZ for a non-quiz lesson`, async () => {
        const url = name.startsWith('GET')
          ? `/api/v1/lessons/${docId}/grades`
          : `/api/v1/lessons/${docId}/grades/${student.id}`;
        const method = name.startsWith('GET') ? 'GET' : name.startsWith('PUT') ? 'PUT' : 'DELETE';
        for (const token of [admin.token, instructor.token]) {
          const response = await app.inject({
            method,
            url,
            headers: auth(token),
            ...(method === 'PUT' ? { payload: { score: 80 } } : {}),
          });
          expect(response.statusCode).toBe(400);
          expect(response.json().error).toEqual({ code: 'NOT_A_QUIZ', message: 'Bu ders bir quiz değil.' });
        }
        expect(await prisma.quizGrade.count()).toBe(0);
      });

      it(`${name}: forbidden callers do not learn the lesson type`, async () => {
        // Yetkisiz kullanıcı için quiz olmayan ders de 403 döner (NOT_A_QUIZ sızdırılmaz).
        const url = name.startsWith('GET')
          ? `/api/v1/lessons/${docId}/grades`
          : `/api/v1/lessons/${docId}/grades/${student.id}`;
        const method = name.startsWith('GET') ? 'GET' : name.startsWith('PUT') ? 'PUT' : 'DELETE';
        const response = await app.inject({
          method,
          url,
          headers: auth(student.token),
          ...(method === 'PUT' ? { payload: { score: 80 } } : {}),
        });
        expect(response.statusCode).toBe(403);
      });
    }

    it('lets ADMIN and the assigned INSTRUCTOR list, put and delete', async () => {
      for (const caller of [admin, instructor]) {
        expect((await list(quizId, caller.token)).statusCode).toBe(200);
        expect((await put(quizId, student.id, { score: 75 }, caller.token)).statusCode).toBe(200);
        const deleted = await remove(quizId, student.id, caller.token);
        expect(deleted.statusCode).toBe(200);
        expect(deleted.json()).toEqual({ deleted: true });
      }
    });

    it('allows grading draft quiz lessons for managers', async () => {
      for (const caller of [admin, instructor]) {
        const listed = await list(draftQuizId, caller.token);
        expect(listed.statusCode).toBe(200);
        expect(listed.json().lesson).toEqual({ id: draftQuizId, title: 'Taslak Quiz', courseId });
        expect((await put(draftQuizId, student.id, { score: 60 }, caller.token)).statusCode).toBe(200);
      }
    });

    it('does not let an instructor of another course manage this one', async () => {
      expect((await list(courseBQuizId, otherInstructor.token)).statusCode).toBe(200);
      expect((await list(courseBQuizId, instructor.token)).statusCode).toBe(403);
    });
  });

  describe('PUT /lessons/:lessonId/grades/:userId', () => {
    it('creates a grade and records the grader and time', async () => {
      const before = Date.now();
      const response = await put(quizId, student.id, { score: 85 }, instructor.token);
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        grade: { userId: student.id, lessonId: quizId, score: 85, gradedAt: expect.any(String) },
      });
      expect(new Date(body.grade.gradedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);

      const row = await prisma.quizGrade.findFirstOrThrow({ where: { userId: student.id, lessonId: quizId } });
      expect(row.score).toBe(85);
      expect(row.gradedById).toBe(instructor.id);
      expect(row.gradedAt.toISOString()).toBe(body.grade.gradedAt);
    });

    it('accepts the boundary scores 0 and 100', async () => {
      expect((await put(quizId, student.id, { score: 0 }, admin.token)).json().grade.score).toBe(0);
      expect((await put(quizId, student.id, { score: 100 }, admin.token)).json().grade.score).toBe(100);
    });

    it('rejects invalid scores with VALIDATION_ERROR and writes nothing', async () => {
      const payloads: unknown[] = [
        { score: -1 },
        { score: 101 },
        { score: 50.5 },
        { score: '80' },
        { score: null },
        { score: true },
        { score: [80] },
        {},
        { points: 80 },
      ];
      for (const payload of payloads) {
        const response = await put(quizId, student.id, payload, admin.token);
        expect(response.statusCode, JSON.stringify(payload)).toBe(400);
        expect(response.json().error.code).toBe('VALIDATION_ERROR');
      }
      // Gövde hiç yok
      const noBody = await put(quizId, student.id, undefined, admin.token);
      expect(noBody.statusCode).toBe(400);
      expect(noBody.json().error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.quizGrade.count()).toBe(0);
    });

    it('rejects students who are not enrolled in the course', async () => {
      for (const target of [outsider.id, courseBStudent.id, instructor.id]) {
        const response = await put(quizId, target, { score: 80 }, admin.token);
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toEqual({
          code: 'STUDENT_NOT_ENROLLED',
          message: 'Öğrenci bu kursa kayıtlı değil.',
        });
      }
      expect(await prisma.quizGrade.count()).toBe(0);
    });

    it('answers an unknown user id like a non-enrolled student', async () => {
      const response = await put(quizId, 'hayali-kullanici', { score: 80 }, admin.token);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('STUDENT_NOT_ENROLLED');
    });

    it('overwrites the existing grade on regrade (single row, new score, time and grader)', async () => {
      await put(quizId, student.id, { score: 60 }, instructor.token);
      const first = await prisma.quizGrade.findFirstOrThrow({ where: { userId: student.id, lessonId: quizId } });
      expect(first.gradedById).toBe(instructor.id);

      // Zaman farkı belirleyici olsun diye ilk notu geçmişe çek.
      const past = new Date('2020-01-01T00:00:00Z');
      await prisma.quizGrade.update({ where: { id: first.id }, data: { gradedAt: past } });

      const response = await put(quizId, student.id, { score: 90 }, admin.token);
      expect(response.statusCode).toBe(200);

      const rows = await prisma.quizGrade.findMany({ where: { userId: student.id, lessonId: quizId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(first.id);
      expect(rows[0].score).toBe(90);
      expect(rows[0].gradedById).toBe(admin.id);
      expect(rows[0].gradedAt.getTime()).toBeGreaterThan(past.getTime());
      expect(Math.abs(Date.now() - rows[0].gradedAt.getTime())).toBeLessThan(60_000);
      expect(response.json().grade).toEqual({
        userId: student.id,
        lessonId: quizId,
        score: 90,
        gradedAt: rows[0].gradedAt.toISOString(),
      });
    });

    it('regrading with the same score still refreshes gradedAt', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      const past = new Date('2020-01-01T00:00:00Z');
      await prisma.quizGrade.updateMany({ where: { userId: student.id }, data: { gradedAt: past } });
      await put(quizId, student.id, { score: 70 }, admin.token);
      const row = await prisma.quizGrade.findFirstOrThrow({ where: { userId: student.id } });
      expect(row.gradedAt.getTime()).toBeGreaterThan(past.getTime());
    });

    it('keeps grades per student and per lesson independent', async () => {
      const second = await makeQuiz('Quiz 2');
      await put(quizId, student.id, { score: 10 }, admin.token);
      await put(quizId, student2.id, { score: 20 }, admin.token);
      await put(second.id, student.id, { score: 30 }, admin.token);
      const rows = await prisma.quizGrade.findMany({ orderBy: { score: 'asc' } });
      expect(rows.map((row) => [row.userId, row.lessonId, row.score])).toEqual([
        [student.id, quizId, 10],
        [student2.id, quizId, 20],
        [student.id, second.id, 30],
      ]);
    });

    it('survives concurrent first writes without duplicating the row', async () => {
      const responses = await Promise.all([
        put(quizId, student.id, { score: 40 }, admin.token),
        put(quizId, student.id, { score: 50 }, admin.token),
        put(quizId, student.id, { score: 60 }, admin.token),
      ]);
      expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
      const rows = await prisma.quizGrade.findMany({ where: { userId: student.id, lessonId: quizId } });
      expect(rows).toHaveLength(1);
      expect([40, 50, 60]).toContain(rows[0].score);
    });
  });

  describe('GET /lessons/:lessonId/grades', () => {
    it('lists every enrolled student, null for ungraded, sorted by Turkish name', async () => {
      const names = ['Zehra Aksoy', 'Çağla Demir', 'Şule Aydın', 'Ömer Can'];
      const extra: TestUser[] = [];
      for (const [index, name] of names.entries()) {
        const user = await makeUser(`extra${index}@example.com`, name, 'STUDENT');
        await enroll(user.id);
        extra.push(user);
      }
      // student = "Ahmet Kaya", student2 = "Zeynep Yıldız" (beforeEach) + 4 ek öğrenci
      await put(quizId, student.id, { score: 91 }, admin.token);
      await put(quizId, extra[1].id, { score: 55 }, admin.token); // Çağla

      const response = await list(quizId, instructor.token);
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.lesson).toEqual({ id: quizId, title: 'Quiz 1', courseId });
      expect(body.grades.map((row: { student: { name: string } }) => row.student.name)).toEqual([
        'Ahmet Kaya',
        'Çağla Demir',
        'Ömer Can',
        'Şule Aydın',
        'Zehra Aksoy',
        'Zeynep Yıldız',
      ]);

      const byId = new Map<string, { score: number | null; gradedAt: string | null }>(
        body.grades.map((row: { student: { id: string }; score: number | null; gradedAt: string | null }) => [
          row.student.id,
          row,
        ]),
      );
      expect(byId.get(student.id)?.score).toBe(91);
      expect(byId.get(student.id)?.gradedAt).toEqual(expect.any(String));
      expect(byId.get(extra[1].id)?.score).toBe(55);
      for (const ungraded of [student2.id, extra[0].id, extra[2].id, extra[3].id]) {
        expect(byId.get(ungraded)).toMatchObject({ score: null, gradedAt: null });
      }
    });

    it('returns the public student shape with email and avatarUrl but no secrets', async () => {
      await prisma.user.update({ where: { id: student.id }, data: { avatarUrl: 'https://img/ahmet' } });
      const body = (await list(quizId, admin.token)).json();
      const row = body.grades.find((entry: { student: { id: string } }) => entry.student.id === student.id);
      expect(row.student).toEqual({
        id: student.id,
        name: 'Ahmet Kaya',
        email: 's1@example.com',
        avatarUrl: 'https://img/ahmet',
      });
      expect(Object.keys(row).sort()).toEqual(['gradedAt', 'score', 'student']);
      const none = body.grades.find((entry: { student: { id: string } }) => entry.student.id === student2.id);
      expect(none.student.avatarUrl).toBeNull();
    });

    it('does not include students of other courses, nor unenrolled students with leftover grades', async () => {
      // B kursu öğrencisinin A quizinde (doğrudan veritabanından) bir notu olsa bile listelenmez.
      await prisma.quizGrade.create({ data: { userId: courseBStudent.id, lessonId: quizId, score: 99 } });
      // Kayıttan çıkarılan öğrencinin notu kalır ama liste yalnızca kayıtlıları gösterir.
      await put(quizId, student2.id, { score: 45 }, admin.token);
      await prisma.enrollment.deleteMany({ where: { userId: student2.id, courseId } });

      const body = (await list(quizId, admin.token)).json();
      expect(body.grades.map((row: { student: { id: string } }) => row.student.id)).toEqual([student.id]);
    });

    it('returns an empty list for a course without students', async () => {
      await prisma.enrollment.deleteMany({ where: { courseId } });
      const response = await list(quizId, admin.token);
      expect(response.statusCode).toBe(200);
      expect(response.json().grades).toEqual([]);
    });

    it('scopes grades to the requested lesson', async () => {
      const second = await makeQuiz('Quiz 2');
      await put(second.id, student.id, { score: 33 }, admin.token);
      const body = (await list(quizId, admin.token)).json();
      expect(body.grades.every((row: { score: number | null }) => row.score === null)).toBe(true);
      const other = (await list(second.id, admin.token)).json();
      expect(other.grades.find((row: { student: { id: string } }) => row.student.id === student.id).score).toBe(33);
    });
  });

  describe('DELETE /lessons/:lessonId/grades/:userId', () => {
    it('removes the grade and is idempotent', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await put(quizId, student2.id, { score: 80 }, admin.token);

      const first = await remove(quizId, student.id, instructor.token);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ deleted: true });

      const second = await remove(quizId, student.id, instructor.token);
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual({ deleted: false });

      const rows = await prisma.quizGrade.findMany();
      expect(rows.map((row) => row.userId)).toEqual([student2.id]);
    });

    it('returns deleted:false for students who were never graded or do not exist', async () => {
      for (const target of [student.id, outsider.id, 'hayali-kullanici']) {
        const response = await remove(quizId, target, admin.token);
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ deleted: false });
      }
    });

    it('can remove the leftover grade of an unenrolled student', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await prisma.enrollment.deleteMany({ where: { userId: student.id } });
      expect((await remove(quizId, student.id, admin.token)).json()).toEqual({ deleted: true });
      expect(await prisma.quizGrade.count()).toBe(0);
    });

    it('reflects in the list afterwards', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await remove(quizId, student.id, admin.token);
      const row = (await list(quizId, admin.token))
        .json()
        .grades.find((entry: { student: { id: string } }) => entry.student.id === student.id);
      expect(row).toMatchObject({ score: null, gradedAt: null });
    });
  });

  describe('cascades', () => {
    it('removes grades when the lesson is deleted (directly and through the API)', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await put(draftQuizId, student.id, { score: 80 }, admin.token);
      expect(await prisma.quizGrade.count()).toBe(2);

      await prisma.lesson.delete({ where: { id: quizId } });
      expect(await prisma.quizGrade.count()).toBe(1);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/lessons/${draftQuizId}`,
        headers: auth(admin.token),
      });
      expect(response.statusCode).toBe(200);
      expect(await prisma.quizGrade.count()).toBe(0);
    });

    it('removes grades when the course is deleted', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await prisma.enrollment.deleteMany({ where: { courseId } });
      await prisma.course.delete({ where: { id: courseId } });
      expect(await prisma.quizGrade.count()).toBe(0);
    });

    it('keeps the grade but clears gradedById when the grader is deleted', async () => {
      await put(quizId, student.id, { score: 70 }, instructor.token);
      await prisma.user.delete({ where: { id: instructor.id } });
      const row = await prisma.quizGrade.findFirstOrThrow({ where: { userId: student.id } });
      expect(row.score).toBe(70);
      expect(row.gradedById).toBeNull();
    });
  });

  describe('GET /users/me/grades', () => {
    /** gradedAt'i kontrol etmek için doğrudan veritabanına not yazar. */
    async function seedGrade(userId: string, lessonId: string, score: number, gradedAt: string) {
      await prisma.quizGrade.create({ data: { userId, lessonId, score, gradedAt: new Date(gradedAt) } });
    }

    it('requires authentication', async () => {
      const response = await myGrades();
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
    });

    it('returns a null summary and an empty list when there are no grades (any role)', async () => {
      for (const caller of [student, instructor, admin]) {
        const response = await myGrades(caller.token);
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          summary: {
            averageScore: null,
            letterGrade: null,
            level: null,
            gradeCount: 0,
            lastScore: null,
            trend: null,
          },
          grades: [],
        });
      }
    });

    it('returns one grade with the course and lesson titles and no trend', async () => {
      await put(quizId, student.id, { score: 80 }, admin.token);
      const body = (await myGrades(student.token)).json();
      expect(body.summary).toEqual({
        averageScore: 80,
        letterGrade: 'BB',
        level: 'İyi',
        gradeCount: 1,
        lastScore: 80,
        trend: null,
      });
      expect(body.grades).toEqual([
        {
          lessonId: quizId,
          lessonTitle: 'Quiz 1',
          courseId,
          courseTitle: 'Kurs A',
          score: 80,
          gradedAt: expect.any(String),
        },
      ]);
    });

    it('computes trend for 2 and 3 grades with the right sign', async () => {
      const q2 = await makeQuiz('Quiz 2');
      const q3 = await makeQuiz('Quiz 3');

      // 2 not: eski 60, yeni 80 -> +20
      await seedGrade(student.id, quizId, 60, '2020-10-01T10:00:00Z');
      await seedGrade(student.id, q2.id, 80, '2020-10-02T10:00:00Z');
      let summary = (await myGrades(student.token)).json().summary;
      expect(summary).toMatchObject({ gradeCount: 2, averageScore: 70, lastScore: 80, trend: 20 });

      // 3 not: eski 60, 80, yeni 50 -> 50 - round(70) = -20
      await seedGrade(student.id, q3.id, 50, '2020-10-03T10:00:00Z');
      summary = (await myGrades(student.token)).json().summary;
      expect(summary).toMatchObject({ gradeCount: 3, averageScore: 63, lastScore: 50, trend: -20 });
      expect(summary.letterGrade).toBe('DD');
      expect(summary.level).toBe('Orta');
    });

    it('uses the most recent grade as lastScore, and regrading moves a grade to the front', async () => {
      const q2 = await makeQuiz('Quiz 2');
      await seedGrade(student.id, quizId, 90, '2020-10-01T10:00:00Z');
      await seedGrade(student.id, q2.id, 70, '2020-10-02T10:00:00Z');
      let body = (await myGrades(student.token)).json();
      expect(body.summary).toMatchObject({ lastScore: 70, trend: -20 });
      expect(body.grades.map((grade: { lessonId: string }) => grade.lessonId)).toEqual([q2.id, quizId]);

      // Eski quiz yeniden notlanınca "en son not" o olur.
      await put(quizId, student.id, { score: 100 }, instructor.token);
      body = (await myGrades(student.token)).json();
      expect(body.grades.map((grade: { lessonId: string }) => grade.lessonId)).toEqual([quizId, q2.id]);
      expect(body.summary).toMatchObject({ lastScore: 100, trend: 30, averageScore: 85, letterGrade: 'BA' });
    });

    it('derives letter grade and level from the rounded average end to end', async () => {
      const q2 = await makeQuiz('Quiz 2');
      await seedGrade(student.id, quizId, 90, '2020-10-01T10:00:00Z');
      await seedGrade(student.id, q2.id, 81, '2020-10-02T10:00:00Z');
      // ortalama 85.5 -> 86
      expect((await myGrades(student.token)).json().summary).toMatchObject({
        averageScore: 86,
        letterGrade: 'BA',
        level: 'Yüksek',
      });
    });

    it('sorts by gradedAt descending, ties by Turkish lesson title', async () => {
      const qC = await makeQuiz('Quiz Ç');
      const qB = await makeQuiz('Quiz B');
      const qA = await makeQuiz('Quiz A');
      const qNew = await makeQuiz('Quiz Z');
      const sameTime = '2020-10-05T10:00:00Z';
      await seedGrade(student.id, qC.id, 10, sameTime);
      await seedGrade(student.id, qB.id, 20, sameTime);
      await seedGrade(student.id, qA.id, 30, sameTime);
      await seedGrade(student.id, quizId, 40, '2020-10-01T10:00:00Z');
      await seedGrade(student.id, qNew.id, 50, '2020-10-09T10:00:00Z');

      const body = (await myGrades(student.token)).json();
      expect(body.grades.map((grade: { lessonTitle: string }) => grade.lessonTitle)).toEqual([
        'Quiz Z',
        'Quiz A',
        'Quiz B',
        'Quiz Ç',
        'Quiz 1',
      ]);
      expect(body.summary.lastScore).toBe(50);
    });

    it('includes grades across courses with their own course titles', async () => {
      const bQuizForStudent = await makeQuiz('B Quiz 2', moduleBId);
      await enroll(student.id, courseBId);
      await seedGrade(student.id, quizId, 70, '2020-10-01T10:00:00Z');
      await seedGrade(student.id, bQuizForStudent.id, 90, '2020-10-02T10:00:00Z');
      const body = (await myGrades(student.token)).json();
      expect(body.grades.map((grade: { courseTitle: string }) => grade.courseTitle)).toEqual(['Kurs B', 'Kurs A']);
      expect(body.grades[0].courseId).toBe(courseBId);
    });

    it('only reports the caller own grades', async () => {
      const q2 = await makeQuiz('Quiz 2');
      await seedGrade(student.id, quizId, 40, '2020-10-01T10:00:00Z');
      await seedGrade(student2.id, quizId, 95, '2020-10-02T10:00:00Z');
      await seedGrade(student2.id, q2.id, 85, '2020-10-03T10:00:00Z');
      await seedGrade(courseBStudent.id, courseBQuizId, 100, '2020-10-04T10:00:00Z');

      const mine = (await myGrades(student.token)).json();
      expect(mine.grades).toHaveLength(1);
      expect(mine.summary).toMatchObject({ gradeCount: 1, averageScore: 40, letterGrade: 'FF', level: 'Düşük' });

      const theirs = (await myGrades(student2.token)).json();
      expect(theirs.grades.map((grade: { score: number }) => grade.score)).toEqual([85, 95]);
      expect(theirs.summary).toMatchObject({ gradeCount: 2, averageScore: 90, letterGrade: 'AA' });

      expect((await myGrades(outsider.token)).json().grades).toEqual([]);
    });

    it('reflects deletion of a grade', async () => {
      await put(quizId, student.id, { score: 70 }, admin.token);
      await remove(quizId, student.id, admin.token);
      expect((await myGrades(student.token)).json().summary.gradeCount).toBe(0);
    });
  });
});
