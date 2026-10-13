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
