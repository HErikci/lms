import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;').catch((err) => {
  console.error('WAL mode etkinleştirilemedi:', err);
});
