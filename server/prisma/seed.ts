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
                {
                  title: 'React Nedir?',
                  order: 1,
                  status: 'PUBLISHED',
                  description: 'React kütüphanesine giriş ve temel kavramlar.',
                  contentType: 'VIDEO_YOUTUBE',
                  contentUrl: 'https://www.youtube.com/watch?v=Tn6-PIqc4UM',
                },
                {
                  title: 'Geliştirme Ortamının Kurulumu',
                  order: 2,
                  status: 'PUBLISHED',
                  description: 'Node.js, npm ve Vite ile React geliştirme ortamının kurulumu.',
                  contentType: 'VIDEO_YOUTUBE',
                  contentUrl: 'https://www.youtube.com/watch?v=O6P86uwfdR0',
                },
                {
                  title: 'Giriş Değerlendirme Sınavı',
                  order: 3,
                  status: 'PUBLISHED',
                  description: 'Bu modülde öğrendiklerinizi ölçen kısa bir sınav.',
                  contentType: 'QUIZ',
                },
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
              create: [],
            },
          },
          {
            title: 'Sınıflar ve Nesneler',
            order: 2,
            lessons: {
              create: [],
            },
          },
          {
            title: 'Kalıtım ve Polimorfizm',
            order: 3,
            lessons: {
              create: [],
            },
          },
          {
            title: 'Kapsülleme ve Soyutlama',
            order: 4,
            lessons: {
              create: [],
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

  await prisma.navMenuItem.createMany({
    data: [
      { path: '/', label: 'Genel Bakış', icon: 'grid_view', order: 1, roles: 'STUDENT,INSTRUCTOR,ADMIN' },
      { path: '/kurslarim', label: 'Kurslarım / Dersler', icon: 'school', order: 2, roles: 'STUDENT,INSTRUCTOR,ADMIN' },
      { path: '/duyurular', label: 'Duyurular', icon: 'campaign', order: 3, roles: 'STUDENT,INSTRUCTOR,ADMIN' },
      { path: '/takvim', label: 'Takvim', icon: 'calendar_today', order: 4, roles: 'STUDENT,INSTRUCTOR,ADMIN' },
      { path: '/notlar-ve-gorevler', label: 'Notlar & Görevler', icon: 'assignment_turned_in', order: 5, roles: 'STUDENT,INSTRUCTOR,ADMIN' },
      { path: '/sinavlar', label: 'Sınav Sistemi', icon: 'quiz', order: 6, roles: 'ADMIN' },
      { path: '/yonetim/kurslar', label: 'Kurs Yönetimi', icon: 'admin_panel_settings', order: 7, roles: 'ADMIN' },
    ],
  });

  console.log('Seed tamamlandı.');
}

main().finally(() => prisma.$disconnect());
