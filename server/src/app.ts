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
