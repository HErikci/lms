import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

describe('nav item routes', () => {
  let app: FastifyInstance;
  let studentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await prisma.navMenuItem.deleteMany();
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
      data: { email: 'admin@example.com', passwordHash, name: 'Admin', role: 'ADMIN' },
    });

    const studentLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'student@example.com', password: 'sifre123' },
    });
    studentToken = studentLogin.json().token;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'sifre123' },
    });
    adminToken = adminLogin.json().token;

    await prisma.navMenuItem.create({
      data: {
        path: '/',
        label: 'Genel Bakış',
        icon: 'home',
        order: 1,
        roles: 'STUDENT,INSTRUCTOR,ADMIN',
      },
    });
    await prisma.navMenuItem.create({
      data: {
        path: '/yonetim/kurslar',
        label: 'Kurs Yönetimi',
        icon: 'school',
        order: 2,
        roles: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/nav-items/me', () => {
    it('returns only items visible to a student', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/nav-items/me',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { items } = response.json();
      expect(items).toEqual([{ path: '/', label: 'Genel Bakış', icon: 'home' }]);
    });

    it('returns admin-only items for an admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/nav-items/me',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { items } = response.json();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({
        path: '/yonetim/kurslar',
        label: 'Kurs Yönetimi',
        icon: 'school',
      });
    });

    it('401s without a token', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/nav-items/me' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/nav-items', () => {
    it('rejects a non-admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it('lists all items with roles as an array for an admin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const { items } = response.json();
      expect(items).toHaveLength(2);
      expect(items[0].roles).toEqual(['STUDENT', 'INSTRUCTOR', 'ADMIN']);
      expect(items[1].roles).toEqual(['ADMIN']);
    });
  });

  describe('POST /api/v1/admin/nav-items', () => {
    it('rejects a non-admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { path: '/x', label: 'X', icon: 'x', order: 3, roles: ['STUDENT'] },
      });
      expect(response.statusCode).toBe(403);
    });

    it('creates a new item as an admin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          path: '/notlar',
          label: 'Notlar',
          icon: 'note',
          order: 3,
          roles: ['STUDENT', 'INSTRUCTOR'],
        },
      });
      expect(response.statusCode).toBe(201);
      const { item } = response.json();
      expect(item.path).toBe('/notlar');
      expect(item.roles).toEqual(['STUDENT', 'INSTRUCTOR']);
    });

    it('rejects invalid roles', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { path: '/x', label: 'X', icon: 'x', order: 3, roles: ['BOGUS'] },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/nav-items',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { label: 'X' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/admin/nav-items/:id', () => {
    it('updates an existing item', async () => {
      const existing = await prisma.navMenuItem.findFirstOrThrow({ where: { path: '/' } });
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/nav-items/${existing.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { label: 'Panel', roles: ['ADMIN'] },
      });
      expect(response.statusCode).toBe(200);
      const { item } = response.json();
      expect(item.label).toBe('Panel');
      expect(item.roles).toEqual(['ADMIN']);
    });

    it('404s for a nonexistent id', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/nav-items/does-not-exist',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { label: 'Panel' },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });

    it('rejects a non-admin', async () => {
      const existing = await prisma.navMenuItem.findFirstOrThrow({ where: { path: '/' } });
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/nav-items/${existing.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { label: 'Panel' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/v1/admin/nav-items/:id', () => {
    it('deletes an existing item', async () => {
      const existing = await prisma.navMenuItem.findFirstOrThrow({ where: { path: '/' } });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/nav-items/${existing.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
      expect(await prisma.navMenuItem.findUnique({ where: { id: existing.id } })).toBeNull();
    });

    it('404s for a nonexistent id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/nav-items/does-not-exist',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });

    it('rejects a non-admin', async () => {
      const existing = await prisma.navMenuItem.findFirstOrThrow({ where: { path: '/' } });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/nav-items/${existing.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
