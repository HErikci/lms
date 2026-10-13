# Backend Çekirdeği: Auth + Kurs/İçerik Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `lms/server/` (Fastify + Prisma + SQLite) implementing registration/login/RBAC and Course→Module→Lesson CRUD + enrollment, then wire `lms/web/` to consume it in place of the dashboard fixture, matching the approved design spec.

**Architecture:** `server/` and `web/` are independent npm packages, no shared workspace. `server/CONTRACT.md` + `server/ARCHITECTURE.md` are written first and treated as frozen interfaces; Prisma schema, backend routes, and frontend data hooks are each built against that contract rather than against each other's source.

**Tech Stack:** Node.js + TypeScript, Fastify, Prisma ORM, SQLite (WAL mode), bcrypt, jsonwebtoken, Vitest (backend tests), existing React 18 + React Router 6 + CSS Modules (`web/`, unchanged stack).

**Spec:** `docs/superpowers/specs/2026-10-13-backend-auth-courses-design.md`

## Global Constraints

- All HTTP error responses use the envelope `{ "error": { "code": "string", "message": "string (Türkçe)" } }` — no raw stack traces reach the client (NFR-35).
- Passwords hashed with bcrypt, cost ≥ 12 (NFR-11).
- Every mutating route is gated by RBAC middleware validated server-side; client-side checks are never trusted (NFR-14).
- API is versioned under `/api/v1` (NFR-52).
- SQLite runs in WAL mode (NFR-05).
- Database migrations are versioned files under `prisma/migrations/`, never hand-edited (NFR-54).
- `server/prisma/schema.prisma` and `prisma/migrations/` are touched only in Task 2 (Database Engineer scope per spec); later tasks read the generated Prisma Client but do not modify the schema.
- Frontend data-layer changes stay inside `web/src/data/` and the new `Kurslarım` page; existing component APIs (`Card`, `Badge`, `ProgressBar`, `Text`, etc.) are reused, not modified.
- Refresh tokens, email verification, and panel-metrics migration are explicitly out of scope (see spec's "Takip Maddeleri").

## Review Focus

- **Duplicate registration email** — registering twice with the same email must return a clean 409-style error envelope, not a raw SQLite unique-constraint message. Covered in Task 4.
- **Wrong-role access to instructor-only routes** — a STUDENT token calling `POST /api/v1/courses` must get a 403 in the standard envelope, not a 500. Covered in Task 5.
- **Login with wrong password / nonexistent email** — must return the same generic "invalid credentials" error for both cases, so the API doesn't leak which emails are registered. Covered in Task 4.
- **Enrolling twice in the same course** — must be rejected (not silently duplicated or crashing on a unique-constraint error). Covered in Task 7.
- **Sequential-access course with lessons fetched out of order** — a SEQUENTIAL course's lesson list must reflect `order`, and the API must not expose a way to skip to a later lesson without completing earlier ones being implied client-side only is acceptable for this slice, but the lesson list itself must always come back correctly ordered. Covered in Task 6.

---

## File Structure

```
lms/server/
├── package.json
├── tsconfig.json
├── .env.example
├── CONTRACT.md
├── ARCHITECTURE.md
├── vitest.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/.gitkeep (replaced by generated migration)
│   └── seed.ts
└── src/
    ├── app.ts                  # buildApp(): creates and returns Fastify instance (no .listen())
    ├── server.ts                # entrypoint: buildApp().listen(...)
    ├── errors.ts                 # AppError class + Fastify error handler
    ├── lib/
    │   ├── prisma.ts             # singleton PrismaClient
    │   └── jwt.ts                # sign/verify helpers
    ├── middleware/
    │   └── rbac.ts               # requireAuth, requireRole(...roles) preHandlers
    └── routes/
        ├── auth.ts               # register, login, me
        ├── courses.ts            # list/get/create courses
        ├── modules.ts            # create module under course
        ├── lessons.ts             # create lesson under module
        └── enrollments.ts        # enroll, list-my-courses

lms/web/src/
├── lib/
│   └── apiClient.ts              # fetch wrapper: base URL, auth header, error envelope parsing
├── data/
│   ├── useAuth.ts                 # login/register/me + token storage
│   └── useDashboardData.ts        # MODIFIED: real fetch, same DashboardData return type
└── features/courses/
    ├── CoursesPage.tsx             # replaces placeholder "Kurslarım" route
    ├── CoursesPage.module.css
    └── useCourses.ts               # fetches GET /api/v1/users/me/courses
```

---

## Task 1: Server Scaffolding + Contract + Architecture Docs

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/CONTRACT.md`
- Create: `server/ARCHITECTURE.md`
- Create: `server/vitest.config.ts`
- Create: `server/src/app.ts`
- Create: `server/src/server.ts`
- Test: `server/src/app.test.ts`

**Interfaces:**
- Produces: `buildApp(): FastifyInstance` (exported from `src/app.ts`) — every later route task registers against this instance via `app.register(...)` or direct route declarations inside `app.ts`.
- Produces: `GET /api/v1/health` → `{ "status": "ok" }` (smoke-test route proving the app boots).

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "@btk-akademi/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "fastify": "^4.28.1",
    "@prisma/client": "^5.19.1",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "prisma": "^5.19.1",
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "vitest": "^2.1.1",
    "@types/node": "^22.5.5",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.7"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/.env.example`**

```
DATABASE_URL="file:./dev.db?connection_limit=1"
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="1h"
PORT=4000
```

Copy it to `server/.env` locally (not committed) before running anything in later tasks.

- [ ] **Step 4: Create `server/CONTRACT.md`**

```markdown
# API Sözleşmesi v1

Taban yol: `/api/v1`. Tüm hata yanıtları: `{ "error": { "code": "string", "message": "Türkçe açıklama" } }`.

## Auth

### POST /api/v1/auth/register
İstek: `{ "email": string, "password": string, "name": string }`
200: `{ "user": { "id": string, "email": string, "name": string, "role": "STUDENT" }, "token": string }`
409: email zaten kayıtlı → `{ "error": { "code": "EMAIL_TAKEN", "message": "Bu e-posta ile zaten bir hesap var." } }`

### POST /api/v1/auth/login
İstek: `{ "email": string, "password": string }`
200: `{ "user": { "id", "email", "name", "role" }, "token": string }`
401: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "E-posta veya şifre hatalı." } }`

### GET /api/v1/auth/me
Header: `Authorization: Bearer <token>`
200: `{ "user": { "id", "email", "name", "role" } }`
401: token yok/geçersiz → `{ "error": { "code": "UNAUTHORIZED", "message": "Giriş yapmanız gerekiyor." } }`

## Courses

### GET /api/v1/courses?category=&level=&tag=&q=
200: `{ "courses": [{ "id", "title", "description", "category", "level", "tags": string[], "accessMode", "status" }] }`

### GET /api/v1/courses/:id
200: `{ "course": { ...yukarıdaki alanlar, "modules": [{ "id", "title", "order", "lessons": [{ "id", "title", "order", "status" }] }] } }`
404: `{ "error": { "code": "NOT_FOUND", "message": "Kurs bulunamadı." } }`

### POST /api/v1/courses (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title", "description", "category", "level", "tags": string[], "accessMode": "SEQUENTIAL"|"FREE" }`
201: `{ "course": { ... } }`
403: yetkisiz rol → `{ "error": { "code": "FORBIDDEN", "message": "Bu işlem için yetkiniz yok." } }`

## Modules / Lessons

### POST /api/v1/courses/:courseId/modules (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title": string, "order": number }`
201: `{ "module": { "id", "courseId", "title", "order" } }`

### POST /api/v1/modules/:moduleId/lessons (rol: INSTRUCTOR, ADMIN)
İstek: `{ "title": string, "order": number, "status": "DRAFT"|"PUBLISHED" }`
201: `{ "lesson": { "id", "moduleId", "title", "order", "status" } }`

## Enrollments

### POST /api/v1/courses/:courseId/enroll (rol: STUDENT)
İstek: `{ "method": "OPEN"|"INVITE_CODE"|"ADMIN_ASSIGNED" }`
201: `{ "enrollment": { "id", "userId", "courseId", "method", "enrolledAt" } }`
409: zaten kayıtlı → `{ "error": { "code": "ALREADY_ENROLLED", "message": "Bu kursa zaten kayıtlısınız." } }`

### GET /api/v1/users/me/courses
200: `{ "courses": [{ "id", "title", "category", "level", "accessMode" }] }`
```

- [ ] **Step 5: Create `server/ARCHITECTURE.md`**

```markdown
# Backend Mimari Standartları

- Katmanlama: `routes/*.ts` sadece istek doğrulama + yanıt şekillendirme yapar; iş mantığı doğrudan route handler içinde Prisma çağrıları olarak kalabilir (bu ölçekte ayrı bir "service" katmanı YAGNI).
- Her route dosyası bir kaynak ailesine karşılık gelir (`auth.ts`, `courses.ts`, ...).
- Hatalar her zaman `throw new AppError(code, message, statusCode)` ile fırlatılır; `src/errors.ts`'deki global handler bunu `{ "error": { code, message } }"` zarfına çevirir. Route içinde asla ham `try/catch` ile JSON yanıtı elle yazılmaz.
- RBAC: `middleware/rbac.ts`'teki `requireAuth` ve `requireRole(...roles)` preHandler'ları route tanımında kullanılır, örn: `{ preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] }`.
- Prisma erişimi her zaman `lib/prisma.ts`'teki tekil `prisma` nesnesi üzerinden yapılır (yeni `PrismaClient()` başka yerde oluşturulmaz).
- Testler Vitest ile `*.test.ts` dosyalarında, test edilen dosyanın yanında tutulur.
```

- [ ] **Step 6: Create `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create `server/src/errors.ts`**

```typescript
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
  }
}

export function errorHandler(
  error: FastifyError | AppError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
    return;
  }
  reply
    .status(500)
    .send({ error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir hata oluştu.' } });
}
```

- [ ] **Step 8: Create `server/src/app.ts`**

```typescript
import Fastify from 'fastify';
import { errorHandler } from './errors.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 9: Create `server/src/server.ts`**

```typescript
import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 10: Write the failing test `server/src/app.test.ts`**

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from './app.js';

describe('health check', () => {
  const app = buildApp();
  afterAll(() => app.close());

  it('returns ok status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 11: Install deps and run the test**

```bash
cd server
npm install
npm test
```

Expected: PASS (the health route already exists in Step 8, so this confirms wiring, not TDD red-green — that starts in Task 3).

- [ ] **Step 12: Commit**

```bash
git add server/package.json server/tsconfig.json server/.env.example server/CONTRACT.md server/ARCHITECTURE.md server/vitest.config.ts server/src/app.ts server/src/server.ts server/src/errors.ts server/src/app.test.ts server/package-lock.json
git commit -m "feat(server): scaffold Fastify app, API contract, architecture docs"
```

---

## Task 2: Prisma Schema, Migration, Seed

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/prisma/seed.ts`
- Generated: `server/prisma/migrations/<timestamp>_init/migration.sql` (via `prisma migrate dev`)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: Prisma Client models `User`, `Course`, `Module`, `Lesson`, `Enrollment` with fields exactly as listed below — every later task's Prisma calls use these field names verbatim.

- [ ] **Step 1: Create `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  STUDENT
  INSTRUCTOR
  ADMIN
}

enum AccessMode {
  SEQUENTIAL
  FREE
}

enum ContentStatus {
  DRAFT
  PUBLISHED
}

enum EnrollmentMethod {
  OPEN
  INVITE_CODE
  ADMIN_ASSIGNED
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  name         String
  avatarUrl    String?
  locale       String       @default("tr")
  role         Role         @default(STUDENT)
  createdAt    DateTime     @default(now())
  courses      Course[]     @relation("InstructorCourses")
  enrollments  Enrollment[]
}

model Course {
  id          String       @id @default(cuid())
  title       String
  description String
  category    String
  level       String
  tags        String       @default("")
  accessMode  AccessMode   @default(FREE)
  status      ContentStatus @default(DRAFT)
  instructorId String
  instructor  User         @relation("InstructorCourses", fields: [instructorId], references: [id])
  modules     Module[]
  enrollments Enrollment[]
}

model Module {
  id       String   @id @default(cuid())
  courseId String
  course   Course   @relation(fields: [courseId], references: [id])
  title    String
  order    Int
  lessons  Lesson[]
}

model Lesson {
  id       String        @id @default(cuid())
  moduleId String
  module   Module        @relation(fields: [moduleId], references: [id])
  title    String
  order    Int
  status   ContentStatus @default(DRAFT)
}

model Enrollment {
  id         String           @id @default(cuid())
  userId     String
  user       User             @relation(fields: [userId], references: [id])
  courseId   String
  course     Course           @relation(fields: [courseId], references: [id])
  method     EnrollmentMethod
  enrolledAt DateTime         @default(now())

  @@unique([userId, courseId])
}
```

`tags` is stored as a comma-joined string (SQLite has no native array type); routes split/join it — this is documented inline in Task 5's course route, not here.

- [ ] **Step 2: Generate the migration**

```bash
cd server
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/<timestamp>_init/migration.sql`, applies it to `dev.db`, runs `prisma generate`. Confirm `server/dev.db` now exists.

- [ ] **Step 3: Enable WAL mode**

Add to `server/prisma/seed.ts` top (and note in a comment that `app.ts`'s Prisma singleton relies on this having run once) — actually WAL is a pragma set per-connection; set it in `lib/prisma.ts` instead, created in Task 3. For now, verify it manually:

```bash
cd server
sqlite3 dev.db "PRAGMA journal_mode=WAL;"
```

Expected output: `wal`. This confirms SQLite supports WAL on this file; `lib/prisma.ts` (Task 3) sets it programmatically on every connection so it doesn't depend on this manual step in other environments.

- [ ] **Step 4: Create `server/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('sifre123', 12);

  const instructor = await prisma.user.create({
    data: {
      email: 'egitmen@btkakademi.test',
      passwordHash,
      name: 'Ayşe Yılmaz',
      role: 'INSTRUCTOR',
    },
  });

  const course = await prisma.course.create({
    data: {
      title: 'React ile Modern Web Geliştirme',
      description: 'React, TypeScript ve modern araçlarla uçtan uca web uygulaması geliştirin.',
      category: 'Yazılım Geliştirme',
      level: 'Orta',
      tags: 'react,typescript,frontend',
      accessMode: 'SEQUENTIAL',
      status: 'PUBLISHED',
      instructorId: instructor.id,
      modules: {
        create: [
          {
            title: 'Giriş ve Kurulum',
            order: 1,
            lessons: {
              create: [
                { title: 'React Nedir?', order: 1, status: 'PUBLISHED' },
                { title: 'Geliştirme Ortamının Kurulumu', order: 2, status: 'PUBLISHED' },
              ],
            },
          },
        ],
      },
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'ogrenci@btkakademi.test',
      passwordHash,
      name: 'Mehmet Demir',
      role: 'STUDENT',
    },
  });

  await prisma.enrollment.create({
    data: { userId: student.id, courseId: course.id, method: 'OPEN' },
  });

  console.log('Seed tamamlandı.');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Run the seed**

```bash
cd server
npm run prisma:seed
```

Expected: prints "Seed tamamlandı." Verify with `npx prisma studio` or a quick query that one course with two lessons and one enrollment exist.

- [ ] **Step 6: Commit**

```bash
git add server/prisma
git commit -m "feat(server): add Prisma schema, initial migration, seed data"
```

---

## Task 3: Prisma Singleton, JWT Helpers, RBAC Middleware

**Files:**
- Create: `server/src/lib/prisma.ts`
- Create: `server/src/lib/jwt.ts`
- Create: `server/src/middleware/rbac.ts`
- Test: `server/src/lib/jwt.test.ts`
- Test: `server/src/middleware/rbac.test.ts`

**Interfaces:**
- Consumes: Prisma Client types generated in Task 2 (`Role` enum: `'STUDENT' | 'INSTRUCTOR' | 'ADMIN'`).
- Produces: `prisma` (singleton, exported from `lib/prisma.ts`), `signToken(payload: { userId: string; role: Role }): string`, `verifyToken(token: string): { userId: string; role: Role }` (throws on invalid/expired), `requireAuth` and `requireRole(...roles: Role[])` Fastify `preHandler` functions that attach `request.user = { userId, role }` on success.

- [ ] **Step 1: Create `server/src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch((err) => {
  console.error('WAL mode etkinleştirilemedi:', err);
});
```

- [ ] **Step 2: Write the failing test `server/src/lib/jwt.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt.js';

describe('jwt helpers', () => {
  it('round-trips a payload', () => {
    const token = signToken({ userId: 'user_1', role: 'STUDENT' });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user_1');
    expect(decoded.role).toBe('STUDENT');
  });

  it('throws on an invalid token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server
npm test -- jwt.test.ts
```

Expected: FAIL — `src/lib/jwt.ts` does not exist yet.

- [ ] **Step 4: Create `server/src/lib/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface TokenPayload {
  userId: string;
  role: Role;
}

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server
npm test -- jwt.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing test `server/src/middleware/rbac.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { signToken } from '../lib/jwt.js';
import { requireAuth, requireRole } from './rbac.js';

function mockReqRes(headers: Record<string, string> = {}) {
  const request = { headers } as unknown as FastifyRequest & { user?: unknown };
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return { request, reply };
}

describe('requireAuth', () => {
  it('attaches request.user for a valid bearer token', async () => {
    const token = signToken({ userId: 'u1', role: 'STUDENT' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    expect((request as any).user).toEqual({ userId: 'u1', role: 'STUDENT' });
  });

  it('rejects a missing token', async () => {
    const { request, reply } = mockReqRes();
    await expect(requireAuth(request, reply)).rejects.toThrow();
  });
});

describe('requireRole', () => {
  it('allows a matching role', async () => {
    const token = signToken({ userId: 'u1', role: 'INSTRUCTOR' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).resolves.not.toThrow();
  });

  it('rejects a non-matching role', async () => {
    const token = signToken({ userId: 'u1', role: 'STUDENT' });
    const { request, reply } = mockReqRes({ authorization: `Bearer ${token}` });
    await requireAuth(request, reply);
    await expect(requireRole('INSTRUCTOR', 'ADMIN')(request, reply)).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
cd server
npm test -- rbac.test.ts
```

Expected: FAIL — `src/middleware/rbac.ts` does not exist yet.

- [ ] **Step 8: Create `server/src/middleware/rbac.ts`**

```typescript
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { AppError } from '../errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', 401);
  }
  const token = header.slice('Bearer '.length);
  try {
    request.user = verifyToken(token);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Giriş yapmanız gerekiyor.', 401);
  }
}

export function requireRole(...roles: TokenPayload['role'][]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user || !roles.includes(request.user.role)) {
      throw new AppError('FORBIDDEN', 'Bu işlem için yetkiniz yok.', 403);
    }
  };
}
```

- [ ] **Step 9: Run test to verify it passes**

```bash
cd server
npm test -- rbac.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add server/src/lib server/src/middleware
git commit -m "feat(server): add Prisma singleton, JWT helpers, RBAC middleware"
```

---

## Task 4: Auth Routes (register, login, me)

**Files:**
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/app.ts` (register the auth routes)
- Test: `server/src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3), `signToken` (Task 3), `requireAuth` (Task 3), `AppError` (Task 1).
- Produces: `registerAuthRoutes(app: FastifyInstance)` exported from `routes/auth.ts`; routes `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me` exactly matching `CONTRACT.md`.

- [ ] **Step 1: Write the failing test `server/src/routes/auth.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('auth routes', () => {
  const app = buildApp();

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers a new user and returns a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'test@example.com', password: 'sifre123', name: 'Test Kullanıcı' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.role).toBe('STUDENT');
    expect(typeof body.token).toBe('string');
  });

  it('rejects duplicate email registration', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'dup@example.com', password: 'sifre123', name: 'Birinci' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'dup@example.com', password: 'baskasifre', name: 'İkinci' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with correct credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'login@example.com', password: 'sifre123', name: 'Giriş Testi' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'login@example.com', password: 'sifre123' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('login@example.com');
  });

  it('rejects login with wrong password using a generic error', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'wrongpw@example.com', password: 'sifre123', name: 'Kullanıcı' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'wrongpw@example.com', password: 'yanlis' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login for a nonexistent email with the same generic error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'yok@example.com', password: 'herhangi' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user for GET /me with a valid token', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'me@example.com', password: 'sifre123', name: 'Ben' },
    });
    const { token } = registerResponse.json();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('me@example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
npm test -- auth.test.ts
```

Expected: FAIL — routes not registered yet (404s).

- [ ] **Step 3: Create `server/src/routes/auth.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

function toPublicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>('/api/v1/auth/register', async (request) => {
    const { email, password, name } = request.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'Bu e-posta ile zaten bir hesap var.', 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'STUDENT' },
    });
    const token = signToken({ userId: user.id, role: user.role });
    return { user: toPublicUser(user), token };
  });

  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const genericError = () =>
      new AppError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401);
    if (!user) throw genericError();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw genericError();
    const token = signToken({ userId: user.id, role: user.role });
    return { user: toPublicUser(user), token };
  });

  app.get(
    '/api/v1/auth/me',
    { preHandler: [requireAuth] },
    async (request) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.userId } });
      return { user: toPublicUser(user) };
    },
  );
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```typescript
import Fastify from 'fastify';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server
npm test -- auth.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/auth.ts server/src/app.ts server/src/routes/auth.test.ts
git commit -m "feat(server): add auth routes (register, login, me)"
```

---

## Task 5: Course Routes (list, get, create)

**Files:**
- Create: `server/src/routes/courses.ts`
- Modify: `server/src/app.ts` (register course routes)
- Test: `server/src/routes/courses.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`, `requireRole` (Task 3), `AppError` (Task 1), `signToken` (reused in test setup only).
- Produces: `registerCourseRoutes(app: FastifyInstance)`; routes `GET /api/v1/courses`, `GET /api/v1/courses/:id`, `POST /api/v1/courses` matching `CONTRACT.md`. Course JSON shape `{ id, title, description, category, level, tags: string[], accessMode, status }` — later tasks (modules, lessons, frontend) reuse this shape.

- [ ] **Step 1: Write the failing test `server/src/routes/courses.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('course routes', () => {
  const app = buildApp();
  let studentToken: string;
  let instructorToken: string;

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    await prisma.user.create({
      data: { email: 'student@example.com', passwordHash, name: 'Öğrenci', role: 'STUDENT' },
    });
    await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });

    const studentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'student@example.com', password: 'sifre123' },
    });
    studentToken = studentLogin.json().token;

    const instructorLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'instructor@example.com', password: 'sifre123' },
    });
    instructorToken = instructorLogin.json().token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows an instructor to create a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Test Kursu',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        tags: ['test', 'örnek'],
        accessMode: 'FREE',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().course.tags).toEqual(['test', 'örnek']);
  });

  it('rejects a student creating a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        title: 'Test Kursu',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        tags: [],
        accessMode: 'FREE',
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('lists courses filtered by category', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Yazılım Kursu',
        description: 'Açıklama',
        category: 'Yazılım',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/courses',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: {
        title: 'Tasarım Kursu',
        description: 'Açıklama',
        category: 'Tasarım',
        level: 'Orta',
        tags: [],
        accessMode: 'FREE',
      },
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/courses?category=Yazılım' });
    expect(response.statusCode).toBe(200);
    const { courses } = response.json();
    expect(courses).toHaveLength(1);
    expect(courses[0].title).toBe('Yazılım Kursu');
  });

  it('returns 404 for a nonexistent course id', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/courses/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
npm test -- courses.test.ts
```

Expected: FAIL — course routes not registered yet.

- [ ] **Step 3: Create `server/src/routes/courses.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateCourseBody {
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: 'SEQUENTIAL' | 'FREE';
}

interface ListCoursesQuery {
  category?: string;
  level?: string;
  tag?: string;
  q?: string;
}

function toPublicCourse(course: {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string;
  accessMode: string;
  status: string;
}) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    tags: course.tags ? course.tags.split(',') : [],
    accessMode: course.accessMode,
    status: course.status,
  };
}

export function registerCourseRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListCoursesQuery }>('/api/v1/courses', async (request) => {
    const { category, level, tag, q } = request.query;
    const courses = await prisma.course.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(level ? { level } : {}),
        ...(tag ? { tags: { contains: tag } } : {}),
        ...(q ? { title: { contains: q } } : {}),
      },
    });
    return { courses: courses.map(toPublicCourse) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/courses/:id', async (request) => {
    const course = await prisma.course.findUnique({
      where: { id: request.params.id },
      include: { modules: { include: { lessons: true }, orderBy: { order: 'asc' } } },
    });
    if (!course) {
      throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
    }
    return {
      course: {
        ...toPublicCourse(course),
        modules: course.modules.map((module) => ({
          id: module.id,
          title: module.title,
          order: module.order,
          lessons: module.lessons
            .sort((a, b) => a.order - b.order)
            .map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              order: lesson.order,
              status: lesson.status,
            })),
        })),
      },
    };
  });

  app.post<{ Body: CreateCourseBody }>(
    '/api/v1/courses',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const { title, description, category, level, tags, accessMode } = request.body;
      const course = await prisma.course.create({
        data: {
          title,
          description,
          category,
          level,
          tags: tags.join(','),
          accessMode,
          instructorId: request.user!.userId,
        },
      });
      reply.status(201);
      return { course: toPublicCourse(course) };
    },
  );
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```typescript
import Fastify from 'fastify';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCourseRoutes } from './routes/courses.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerCourseRoutes(app);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server
npm test -- courses.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/courses.ts server/src/app.ts server/src/routes/courses.test.ts
git commit -m "feat(server): add course list/get/create routes"
```

---

## Task 6: Module and Lesson Routes

**Files:**
- Create: `server/src/routes/modules.ts`
- Create: `server/src/routes/lessons.ts`
- Modify: `server/src/app.ts` (register both)
- Test: `server/src/routes/modules.test.ts`
- Test: `server/src/routes/lessons.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`, `requireRole` (Task 3), `AppError` (Task 1).
- Produces: `registerModuleRoutes(app)`, `registerLessonRoutes(app)`; routes `POST /api/v1/courses/:courseId/modules`, `POST /api/v1/modules/:moduleId/lessons` matching `CONTRACT.md`.

- [ ] **Step 1: Write the failing test `server/src/routes/modules.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('module routes', () => {
  const app = buildApp();
  let instructorToken: string;
  let courseId: string;

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    const instructor = await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'instructor@example.com', password: 'sifre123' },
    });
    instructorToken = login.json().token;

    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'FREE',
        instructorId: instructor.id,
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a module under a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/modules`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Modül 1', order: 1 },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().module.courseId).toBe(courseId);
  });

  it('returns 404 when the course does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/does-not-exist/modules',
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Modül 1', order: 1 },
    });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
npm test -- modules.test.ts
```

Expected: FAIL — route not registered.

- [ ] **Step 3: Create `server/src/routes/modules.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateModuleBody {
  title: string;
  order: number;
}

export function registerModuleRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: CreateModuleBody }>(
    '/api/v1/courses/:courseId/modules',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const module = await prisma.module.create({
        data: {
          courseId: course.id,
          title: request.body.title,
          order: request.body.order,
        },
      });
      reply.status(201);
      return { module: { id: module.id, courseId: module.courseId, title: module.title, order: module.order } };
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes (after registering in app.ts — see Step 6)**

(Hold off running until Step 6 registers the route; Step 5 covers lessons first.)

- [ ] **Step 5: Write the failing test `server/src/routes/lessons.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('lesson routes', () => {
  const app = buildApp();
  let instructorToken: string;
  let moduleId: string;

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    const instructor = await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'instructor@example.com', password: 'sifre123' },
    });
    instructorToken = login.json().token;

    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'SEQUENTIAL',
        instructorId: instructor.id,
      },
    });
    const module = await prisma.module.create({ data: { courseId: course.id, title: 'Modül', order: 1 } });
    moduleId = module.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a lesson under a module', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/modules/${moduleId}/lessons`,
      headers: { authorization: `Bearer ${instructorToken}` },
      payload: { title: 'Ders 1', order: 1, status: 'DRAFT' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().lesson.moduleId).toBe(moduleId);
  });

  it('returns lessons in order when the course is fetched', async () => {
    await prisma.lesson.create({ data: { moduleId, title: 'İkinci Ders', order: 2, status: 'PUBLISHED' } });
    await prisma.lesson.create({ data: { moduleId, title: 'Birinci Ders', order: 1, status: 'PUBLISHED' } });
    const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
    const response = await app.inject({ method: 'GET', url: `/api/v1/courses/${module.courseId}` });
    const lessons = response.json().course.modules[0].lessons;
    expect(lessons.map((l: { title: string }) => l.title)).toEqual(['Birinci Ders', 'İkinci Ders']);
  });
});
```

- [ ] **Step 6: Create `server/src/routes/lessons.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface CreateLessonBody {
  title: string;
  order: number;
  status: 'DRAFT' | 'PUBLISHED';
}

export function registerLessonRoutes(app: FastifyInstance) {
  app.post<{ Params: { moduleId: string }; Body: CreateLessonBody }>(
    '/api/v1/modules/:moduleId/lessons',
    { preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] },
    async (request, reply) => {
      const module = await prisma.module.findUnique({ where: { id: request.params.moduleId } });
      if (!module) {
        throw new AppError('NOT_FOUND', 'Modül bulunamadı.', 404);
      }
      const lesson = await prisma.lesson.create({
        data: {
          moduleId: module.id,
          title: request.body.title,
          order: request.body.order,
          status: request.body.status,
        },
      });
      reply.status(201);
      return {
        lesson: { id: lesson.id, moduleId: lesson.moduleId, title: lesson.title, order: lesson.order, status: lesson.status },
      };
    },
  );
}
```

- [ ] **Step 7: Register both route sets in `server/src/app.ts`**

```typescript
import Fastify from 'fastify';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerLessonRoutes } from './routes/lessons.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerCourseRoutes(app);
  registerModuleRoutes(app);
  registerLessonRoutes(app);

  return app;
}
```

- [ ] **Step 8: Run both test files to verify they pass**

```bash
cd server
npm test -- modules.test.ts lessons.test.ts
```

Expected: PASS (2 + 2 tests).

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/modules.ts server/src/routes/lessons.ts server/src/app.ts server/src/routes/modules.test.ts server/src/routes/lessons.test.ts
git commit -m "feat(server): add module and lesson creation routes"
```

---

## Task 7: Enrollment Routes

**Files:**
- Create: `server/src/routes/enrollments.ts`
- Modify: `server/src/app.ts` (register enrollment routes)
- Test: `server/src/routes/enrollments.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`, `requireRole` (Task 3), `AppError` (Task 1).
- Produces: `registerEnrollmentRoutes(app)`; routes `POST /api/v1/courses/:courseId/enroll`, `GET /api/v1/users/me/courses` matching `CONTRACT.md`. This is the last backend task — `GET /api/v1/users/me/courses`'s response shape is what Task 9 (frontend `useCourses.ts`) consumes directly.

- [ ] **Step 1: Write the failing test `server/src/routes/enrollments.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('enrollment routes', () => {
  const app = buildApp();
  let studentToken: string;
  let courseId: string;

  beforeEach(async () => {
    await prisma.enrollment.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.module.deleteMany();
    await prisma.course.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('sifre123', 12);
    const instructor = await prisma.user.create({
      data: { email: 'instructor@example.com', passwordHash, name: 'Eğitmen', role: 'INSTRUCTOR' },
    });
    await prisma.user.create({
      data: { email: 'student@example.com', passwordHash, name: 'Öğrenci', role: 'STUDENT' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'student@example.com', password: 'sifre123' },
    });
    studentToken = login.json().token;

    const course = await prisma.course.create({
      data: {
        title: 'Kurs',
        description: 'Açıklama',
        category: 'Test',
        level: 'Başlangıç',
        accessMode: 'FREE',
        instructorId: instructor.id,
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('enrolls a student in a course', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().enrollment.courseId).toBe(courseId);
  });

  it('rejects enrolling twice in the same course', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ALREADY_ENROLLED');
  });

  it('lists the current user enrolled courses', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: { method: 'OPEN' },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/courses',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().courses).toHaveLength(1);
    expect(response.json().courses[0].id).toBe(courseId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server
npm test -- enrollments.test.ts
```

Expected: FAIL — routes not registered.

- [ ] **Step 3: Create `server/src/routes/enrollments.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';
import { AppError } from '../errors.js';

interface EnrollBody {
  method: 'OPEN' | 'INVITE_CODE' | 'ADMIN_ASSIGNED';
}

export function registerEnrollmentRoutes(app: FastifyInstance) {
  app.post<{ Params: { courseId: string }; Body: EnrollBody }>(
    '/api/v1/courses/:courseId/enroll',
    { preHandler: [requireAuth, requireRole('STUDENT')] },
    async (request, reply) => {
      const course = await prisma.course.findUnique({ where: { id: request.params.courseId } });
      if (!course) {
        throw new AppError('NOT_FOUND', 'Kurs bulunamadı.', 404);
      }
      const existing = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: request.user!.userId, courseId: course.id } },
      });
      if (existing) {
        throw new AppError('ALREADY_ENROLLED', 'Bu kursa zaten kayıtlısınız.', 409);
      }
      const enrollment = await prisma.enrollment.create({
        data: { userId: request.user!.userId, courseId: course.id, method: request.body.method },
      });
      reply.status(201);
      return {
        enrollment: {
          id: enrollment.id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          method: enrollment.method,
          enrolledAt: enrollment.enrolledAt,
        },
      };
    },
  );

  app.get(
    '/api/v1/users/me/courses',
    { preHandler: [requireAuth] },
    async (request) => {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: request.user!.userId },
        include: { course: true },
      });
      return {
        courses: enrollments.map(({ course }) => ({
          id: course.id,
          title: course.title,
          category: course.category,
          level: course.level,
          accessMode: course.accessMode,
        })),
      };
    },
  );
}
```

- [ ] **Step 4: Register the routes in `server/src/app.ts`**

```typescript
import Fastify from 'fastify';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerLessonRoutes } from './routes/lessons.js';
import { registerEnrollmentRoutes } from './routes/enrollments.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerCourseRoutes(app);
  registerModuleRoutes(app);
  registerLessonRoutes(app);
  registerEnrollmentRoutes(app);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server
npm test -- enrollments.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Run the full backend test suite**

```bash
cd server
npm test
```

Expected: all test files pass (app, jwt, rbac, auth, courses, modules, lessons, enrollments).

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/enrollments.ts server/src/app.ts server/src/routes/enrollments.test.ts
git commit -m "feat(server): add enrollment routes"
```

---

## Task 8: Frontend API Client + Auth Hook + Login Page

**Files:**
- Create: `web/src/lib/apiClient.ts`
- Create: `web/src/data/useAuth.ts`
- Create: `web/src/features/auth/LoginPage.tsx`
- Create: `web/src/features/auth/LoginPage.module.css`
- Modify: `web/src/routes/index.tsx` (add `/giris` route, wrap protected routes)
- Test: manual (no frontend test framework exists yet, per spec)

**Interfaces:**
- Consumes: `CONTRACT.md`'s auth endpoints (Task 4, already implemented and running on `http://localhost:4000`).
- Produces: `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` (throws `ApiError` with `{ code, message }` on non-2xx), `useAuth()` hook returning `{ user, token, login, register, logout }`, used by Task 9's `useCourses.ts` and by `useDashboardData.ts`.

- [ ] **Step 1: Read the existing router to see current route structure**

Open `web/src/routes/index.tsx` and `web/src/layout/Sidebar/navItems.ts` before editing — confirm the exact placeholder route for "Kurslarım" and the `PlaceholderPage` component's import path, since Task 9 replaces that route's element.

- [ ] **Step 2: Create `web/src/lib/apiClient.ts`**

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(body.error.code, body.error.message, response.status);
  }

  return body as T;
}
```

- [ ] **Step 3: Create `web/src/data/useAuth.ts`**

```typescript
import { useCallback, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('authToken', result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const result = await apiFetch<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    localStorage.setItem('authToken', result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUser(null);
  }, []);

  return { user, login, register, logout };
}
```

- [ ] **Step 4: Create `web/src/features/auth/LoginPage.module.css`**

```css
.container {
  max-width: 360px;
  margin: var(--space-2xl) auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.input {
  padding: var(--space-sm);
  border-radius: var(--radius-default);
  border: 1px solid var(--color-outline);
}

.error {
  color: var(--color-state-error);
}
```

(Verify `--color-outline` and `--color-state-error` exact token names against `web/src/styles/tokens.css` before using — adjust names to match if they differ.)

- [ ] **Step 5: Create `web/src/features/auth/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../data/useAuth';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız.');
    }
  }

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <Text role="headline-sm" as="h1">Giriş Yap</Text>
      <input
        className={styles.input}
        type="email"
        placeholder="E-posta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className={styles.input}
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <Text role="body-sm" tone="error">{error}</Text>}
      <Button variant="primary" type="submit">Giriş Yap</Button>
    </form>
  );
}
```

(Check `Button` and `Text` prop names against their actual `index.ts`/`.tsx` exports before finalizing — adjust `type="submit"` support or `tone="error"` naming if the real components differ from the CLAUDE.md reference table.)

- [ ] **Step 6: Add the `/giris` route in `web/src/routes/index.tsx`**

Add a top-level (non-AppShell-wrapped) route for `/giris` rendering `LoginPage`, alongside the existing `AppShell`-wrapped routes. Exact wiring depends on the current router structure read in Step 1 — follow the same pattern used for the existing placeholder routes, just without nesting under `AppShell`.

- [ ] **Step 7: Manual verification**

```bash
cd server && npm run dev
```

In a second terminal:

```bash
cd web && npm run dev
```

Open `http://localhost:5173/giris`, log in with the seeded `ogrenci@btkakademi.test` / `sifre123` from Task 2's seed. Expected: redirected to `/`, no console errors, `localStorage.authToken` is set (check via browser devtools).

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/data/useAuth.ts web/src/features/auth web/src/routes/index.tsx
git commit -m "feat(web): add API client, auth hook, login page"
```

---

## Task 9: Kurslarım Page Wired to the Real API

**Files:**
- Create: `web/src/features/courses/useCourses.ts`
- Create: `web/src/features/courses/CoursesPage.tsx`
- Create: `web/src/features/courses/CoursesPage.module.css`
- Modify: `web/src/routes/index.tsx` (replace the "Kurslarım" placeholder element with `CoursesPage`)

**Interfaces:**
- Consumes: `apiFetch` (Task 8), `GET /api/v1/users/me/courses` response shape from Task 7 (`{ courses: [{ id, title, category, level, accessMode }] }`).
- Produces: `CoursesPage` React component, mounted at the existing "Kurslarım" route path.

- [ ] **Step 1: Create `web/src/features/courses/useCourses.ts`**

```typescript
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';

export interface EnrolledCourseSummary {
  id: string;
  title: string;
  category: string;
  level: string;
  accessMode: 'SEQUENTIAL' | 'FREE';
}

export function useCourses() {
  const [courses, setCourses] = useState<EnrolledCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ courses: EnrolledCourseSummary[] }>('/api/v1/users/me/courses')
      .then((result) => setCourses(result.courses))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kurslar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  return { courses, loading, error };
}
```

- [ ] **Step 2: Create `web/src/features/courses/CoursesPage.module.css`**

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--gutter);
  padding: var(--margin);
}
```

- [ ] **Step 3: Create `web/src/features/courses/CoursesPage.tsx`**

```tsx
import { useCourses } from './useCourses';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { Badge } from '../../components/Badge';
import styles from './CoursesPage.module.css';

export function CoursesPage() {
  const { courses, loading, error } = useCourses();

  if (loading) return <Text role="body-md">Yükleniyor…</Text>;
  if (error) return <Text role="body-md" tone="error">{error}</Text>;
  if (courses.length === 0) return <Text role="body-md">Henüz kayıtlı bir kursunuz yok.</Text>;

  return (
    <div className={styles.grid}>
      {courses.map((course) => (
        <Card key={course.id} padding="md" elevation={1}>
          <Text role="title-md" as="h3">{course.title}</Text>
          <Text role="body-sm" tone="muted">{course.category} · {course.level}</Text>
          <Badge tone="info" variant="soft">
            {course.accessMode === 'SEQUENTIAL' ? 'Sıralı Erişim' : 'Serbest Erişim'}
          </Badge>
        </Card>
      ))}
    </div>
  );
}
```

(Verify `Card`, `Text`, `Badge` prop signatures against their actual source before finalizing, same caveat as Task 8 Step 5.)

- [ ] **Step 4: Replace the "Kurslarım" placeholder route in `web/src/routes/index.tsx`**

Find the route currently rendering `PlaceholderPage` for the Kurslarım path (identified in Task 8 Step 1) and swap its `element` to `<CoursesPage />`, importing from `../features/courses/CoursesPage`.

- [ ] **Step 5: Manual verification**

With both dev servers still running from Task 8 Step 7, navigate to the Kurslarım nav item while logged in as `ogrenci@btkakademi.test`. Expected: one course card ("React ile Modern Web Geliştirme" from the Task 2 seed) showing category, level, and a "Sıralı Erişim" badge, no console errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/courses web/src/routes/index.tsx
git commit -m "feat(web): wire Kurslarım page to real enrollment API"
```

---

## Task 10: Final Backend Suite Run + Branch Review Handoff

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite one more time from a clean install**

```bash
cd server
rm -rf node_modules dev.db
npm install
npx prisma migrate deploy
npm run prisma:seed
npm test
```

Expected: all tests pass on a fresh install, confirming no hidden local-state dependency.

- [ ] **Step 2: Confirm the frontend builds**

```bash
cd web
npm run typecheck
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Request code review per superpowers:requesting-code-review**

Hand off the full `server/` + `web/` diff for review before merging, per the project's "single squashed PR per feature" convention (CLAUDE.md Git & Commit Conventions).
