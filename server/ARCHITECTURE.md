# Backend Mimari Standartları

- Katmanlama: `routes/*.ts` sadece istek doğrulama + yanıt şekillendirme yapar; iş mantığı doğrudan route handler içinde Prisma çağrıları olarak kalabilir (bu ölçekte ayrı bir "service" katmanı YAGNI).
- Her route dosyası bir kaynak ailesine karşılık gelir (`auth.ts`, `courses.ts`, ...).
- Hatalar her zaman `throw new AppError(code, message, statusCode)` ile fırlatılır; `src/errors.ts`'deki global handler bunu `{ "error": { code, message } }"` zarfına çevirir. Route içinde asla ham `try/catch` ile JSON yanıtı elle yazılmaz.
- RBAC: `middleware/rbac.ts`'teki `requireAuth` ve `requireRole(...roles)` preHandler'ları route tanımında kullanılır, örn: `{ preHandler: [requireAuth, requireRole('INSTRUCTOR', 'ADMIN')] }`.
- Prisma erişimi her zaman `lib/prisma.ts`'teki tekil `prisma` nesnesi üzerinden yapılır (yeni `PrismaClient()` başka yerde oluşturulmaz).
- Testler Vitest ile `*.test.ts` dosyalarında, test edilen dosyanın yanında tutulur.
