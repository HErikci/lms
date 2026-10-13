import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';
import { assertCanManageCourse, assignedCourseIds } from '../lib/courseAccess.js';
import {
  canEditBank,
  canReadBank,
  normalizeQuestionInput,
  questionInclude,
  serializeQuestion,
  toRawQuestion,
  type RawQuestionInput,
} from '../lib/questions.js';

type AuthUser = NonNullable<Parameters<typeof assertCanManageCourse>[0]>;

const MAX_BANK_NAME = 150;
const MAX_BANK_DESCRIPTION = 2000;

const bankInclude = {
  course: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { questions: true } },
} as const;

type BankRow = {
  id: string;
  name: string;
  description: string | null;
  courseId: string | null;
  course: { id: string; title: string } | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { questions: number };
};

function validation(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}

function requireBodyObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw validation('İstek gövdesi bir nesne olmalıdır.');
  }
  return body as Record<string, unknown>;
}

function serializeBank(bank: BankRow, canEdit: boolean) {
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    course: bank.course ? { id: bank.course.id, title: bank.course.title } : null,
    questionCount: bank._count.questions,
    createdBy: bank.createdBy ? { id: bank.createdBy.id, name: bank.createdBy.name } : null,
    createdAt: bank.createdAt.toISOString(),
    updatedAt: bank.updatedAt.toISOString(),
    canEdit,
  };
}

function parseBankName(value: unknown): string {
  if (typeof value !== 'string') throw validation('name zorunludur.');
  const name = value.trim();
  if (name.length < 1 || name.length > MAX_BANK_NAME) {
    throw validation(`name 1 ile ${MAX_BANK_NAME} karakter arasında olmalıdır.`);
  }
  return name;
}

function parseBankDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw validation('description metin olmalıdır.');
  const trimmed = value.trim();
  if (trimmed.length > MAX_BANK_DESCRIPTION) {
    throw validation(`description en fazla ${MAX_BANK_DESCRIPTION} karakter olabilir.`);
  }
  return trimmed === '' ? null : trimmed;
}

/** Bankayı yükler ve okuma yetkisini doğrular; görünmeyen banka 404 döner (varlığı sızdırılmaz). */
async function loadReadableBank(user: AuthUser, id: string) {
  const bank = await prisma.questionBank.findUnique({ where: { id }, include: bankInclude });
  const assigned = await assignedCourseIds(user);
  if (!bank || !canReadBank(user, bank.courseId, assigned)) {
    throw new AppError('NOT_FOUND', 'Soru bankası bulunamadı.', 404);
  }
  return { bank, assigned, canEdit: canEditBank(user, bank.courseId, assigned) };
}

async function loadEditableBank(user: AuthUser, id: string) {
  const loaded = await loadReadableBank(user, id);
  if (!loaded.canEdit) {
    throw new AppError('FORBIDDEN', 'Bu soru bankasını düzenleme yetkiniz yok.', 403);
  }
  return loaded;
}

async function loadEditableQuestion(user: AuthUser, id: string) {
  const question = await prisma.question.findUnique({ where: { id }, include: questionInclude });
  if (!question) throw new AppError('NOT_FOUND', 'Soru bulunamadı.', 404);
  await loadEditableBank(user, question.bankId);
  return question;
}

const QUESTION_FIELDS = ['type', 'stem', 'content', 'explanation', 'topic', 'difficulty', 'points'] as const;

export function registerQuestionBankRoutes(app: FastifyInstance) {
  const staff = { preHandler: [requireAuth, requireRole('ADMIN', 'INSTRUCTOR')] };

  app.get('/api/v1/question-banks', staff, async (request) => {
    const user = request.user!;
    const assigned = await assignedCourseIds(user);
    const where =
      user.role === 'ADMIN' ? {} : { OR: [{ courseId: null }, { courseId: { in: [...assigned] } }] };
    const banks = await prisma.questionBank.findMany({
      where,
      include: bankInclude,
      orderBy: [{ updatedAt: 'desc' }],
    });
    return { banks: banks.map((bank) => serializeBank(bank, canEditBank(user, bank.courseId, assigned))) };
  });

  app.post<{ Body: unknown }>('/api/v1/question-banks', staff, async (request, reply) => {
    const user = request.user!;
    const body = requireBodyObject(request.body);
    const name = parseBankName(body.name);
    const description = parseBankDescription(body.description);

    let courseId: string | null = null;
    if (body.courseId !== undefined && body.courseId !== null) {
      if (typeof body.courseId !== 'string' || body.courseId === '') {
        throw validation('courseId geçerli bir kurs kimliği veya null olmalıdır.');
      }
      const course = await prisma.course.findUnique({ where: { id: body.courseId }, select: { id: true } });
      if (!course) throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      await assertCanManageCourse(user, course.id);
      courseId = course.id;
    } else if (user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Genel soru bankalarını yalnızca yöneticiler oluşturabilir.', 403);
    }

    const bank = await prisma.questionBank.create({
      data: { name, description, courseId, createdById: user.userId },
      include: bankInclude,
    });
    reply.status(201);
    return { bank: serializeBank(bank, true) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/question-banks/:id', staff, async (request) => {
    const { bank, canEdit } = await loadReadableBank(request.user!, request.params.id);
    return { bank: serializeBank(bank, canEdit) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/v1/question-banks/:id', staff, async (request) => {
    const body = requireBodyObject(request.body);
    if (body.courseId !== undefined) {
      throw validation('Bankanın kursu sonradan değiştirilemez; yeni bir banka oluşturun.');
    }
    if (body.name === undefined && body.description === undefined) {
      throw validation('Güncellenecek en az bir alan gönderilmelidir.');
    }
    const { bank } = await loadEditableBank(request.user!, request.params.id);
    const updated = await prisma.questionBank.update({
      where: { id: bank.id },
      data: {
        ...(body.name !== undefined ? { name: parseBankName(body.name) } : {}),
        ...(body.description !== undefined ? { description: parseBankDescription(body.description) } : {}),
      },
      include: bankInclude,
    });
    return { bank: serializeBank(updated, true) };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/question-banks/:id', staff, async (request) => {
    const { bank } = await loadEditableBank(request.user!, request.params.id);
    const links = await prisma.examQuestion.findMany({
      where: { question: { bankId: bank.id } },
      select: { examId: true },
    });
    if (links.length > 0) {
      const examCount = new Set(links.map((link) => link.examId)).size;
      throw new AppError(
        'BANK_IN_USE',
        `Bu bankadaki sorular ${examCount} sınavda kullanılıyor. Önce soruları sınavlardan çıkarın.`,
        409,
      );
    }
    // Sorular bankayla birlikte silinir (cascade).
    await prisma.questionBank.deleteMany({ where: { id: bank.id } });
    return { deleted: true };
  });

  app.get<{ Params: { id: string } }>('/api/v1/question-banks/:id/questions', staff, async (request) => {
    const { bank, canEdit } = await loadReadableBank(request.user!, request.params.id);
    const questions = await prisma.question.findMany({
      where: { bankId: bank.id },
      include: questionInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { questions: questions.map((question) => serializeQuestion(question, canEdit)) };
  });

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/question-banks/:id/questions',
    staff,
    async (request, reply) => {
      const user = request.user!;
      const { bank } = await loadEditableBank(user, request.params.id);
      const data = normalizeQuestionInput(requireBodyObject(request.body) as RawQuestionInput);
      const created = await prisma.question.create({
        data: { ...data, content: JSON.stringify(data.content), bankId: bank.id, createdById: user.userId },
        include: questionInclude,
      });
      reply.status(201);
      return { question: serializeQuestion(created, true) };
    },
  );

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/v1/questions/:id', staff, async (request) => {
    const existing = await loadEditableQuestion(request.user!, request.params.id);
    const body = requireBodyObject(request.body);
    if (!QUESTION_FIELDS.some((field) => body[field] !== undefined)) {
      throw validation('Güncellenecek en az bir alan gönderilmelidir.');
    }
    if (body.type !== undefined && body.type !== existing.type && body.content === undefined) {
      throw validation('Soru tipi değiştirilirken yeni tipe uygun content gönderilmelidir.');
    }

    const merged: Record<string, unknown> = { ...toRawQuestion(existing) };
    for (const field of QUESTION_FIELDS) {
      if (body[field] !== undefined) merged[field] = body[field];
    }
    const data = normalizeQuestionInput(merged as RawQuestionInput);
    const updated = await prisma.question.update({
      where: { id: existing.id },
      data: { ...data, content: JSON.stringify(data.content) },
      include: questionInclude,
    });
    return { question: serializeQuestion(updated, true) };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/questions/:id', staff, async (request) => {
    const question = await loadEditableQuestion(request.user!, request.params.id);
    if (question._count.examLinks > 0) {
      throw new AppError(
        'QUESTION_IN_USE',
        `Bu soru ${question._count.examLinks} sınavda kullanılıyor. Önce sınavlardan çıkarın.`,
        409,
      );
    }
    await prisma.question.deleteMany({ where: { id: question.id } });
    return { deleted: true };
  });
}
