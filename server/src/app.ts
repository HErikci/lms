import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerLessonRoutes } from './routes/lessons.js';
import { registerEnrollmentRoutes } from './routes/enrollments.js';
import { registerUserRoutes } from './routes/users.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Kaynak bulunamadı.' } });
  });

  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  registerAuthRoutes(app);
  registerCourseRoutes(app);
  registerModuleRoutes(app);
  registerLessonRoutes(app);
  registerEnrollmentRoutes(app);
  registerUserRoutes(app);

  await app.ready();
  return app;
}
