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
      roles: 'INSTRUCTOR',
      avatarUrl: 'https://i.pravatar.cc/150?u=egitmen@btkakademi.test',
      locale: 'tr',
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

  const oopCourse = await prisma.course.create({
    data: {
      title: 'Nesne Yönelimli Programlama',
      description:
        'Sınıflar, nesneler, kalıtım, kapsülleme, polimorfizm ve soyutlama gibi temel OOP kavramlarını örneklerle öğrenin.',
      category: 'Yazılım Geliştirme',
      level: 'Başlangıç',
      tags: 'oop,java,yazilim-tasarimi',
      accessMode: 'SEQUENTIAL',
      status: 'PUBLISHED',
      instructorId: instructor.id,
      modules: {
        create: [
          {
            title: "OOP'a Giriş",
            order: 1,
            lessons: {
              create: [
                { title: 'Nesne Yönelimli Programlama Nedir?', order: 1, status: 'PUBLISHED' },
                { title: 'Prosedürel Programlamadan OOP\'a Geçiş', order: 2, status: 'PUBLISHED' },
              ],
            },
          },
          {
            title: 'Sınıflar ve Nesneler',
            order: 2,
            lessons: {
              create: [
                { title: 'Sınıf ve Nesne Kavramları', order: 1, status: 'PUBLISHED' },
                { title: 'Kurucu Metotlar (Constructor)', order: 2, status: 'PUBLISHED' },
                { title: 'Nesne Yaşam Döngüsü', order: 3, status: 'PUBLISHED' },
              ],
            },
          },
          {
            title: 'Kalıtım ve Polimorfizm',
            order: 3,
            lessons: {
              create: [
                { title: 'Kalıtım (Inheritance) Temelleri', order: 1, status: 'PUBLISHED' },
                { title: 'Polimorfizm ve Metot Ezme (Override)', order: 2, status: 'PUBLISHED' },
              ],
            },
          },
          {
            title: 'Kapsülleme ve Soyutlama',
            order: 4,
            lessons: {
              create: [
                { title: 'Kapsülleme (Encapsulation) ve Erişim Belirleyiciler', order: 1, status: 'PUBLISHED' },
                { title: 'Soyutlama (Abstraction) ve Arayüzler', order: 2, status: 'PUBLISHED' },
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
      roles: 'STUDENT,ADMIN',
      avatarUrl: 'https://i.pravatar.cc/150?u=ogrenci@btkakademi.test',
      locale: 'tr',
    },
  });

  await prisma.enrollment.create({
    data: { userId: student.id, courseId: course.id, method: 'OPEN' },
  });

  await prisma.enrollment.create({
    data: { userId: student.id, courseId: oopCourse.id, method: 'OPEN' },
  });

  console.log('Seed tamamlandı.');
}

main().finally(() => prisma.$disconnect());
