import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './prisma.js';
import { sendGuardianReport } from './guardianNotifications.js';
import type { GuardianReport } from './guardians.js';

describe('guardian report delivery', () => {
  let linkId: string;
  let studentId: string;
  let guardianId: string;
  let report: GuardianReport;
  let fetchMock: ReturnType<typeof vi.fn>;

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { endsWith: '.notify@example.com' } } });
  }

  beforeEach(async () => {
    await cleanup();
    vi.stubEnv('RESEND_API_KEY', 'test-secret-never-send');
    vi.stubEnv('GUARDIAN_EMAIL_FROM', 'School <school@example.com>');
    vi.stubEnv('TWILIO_ACCOUNT_SID', `AC${'0'.repeat(32)}`);
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-sms-secret');
    vi.stubEnv('TWILIO_SMS_FROM', '+15551234567');
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-message-id' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const student = await prisma.user.create({ data: {
      email: 'child.notify@example.com', name: 'Deniz', passwordHash: 'unused', role: 'STUDENT', roles: 'STUDENT',
      birthDate: new Date(Date.UTC(new Date().getUTCFullYear() - 10, 0, 1)),
    } });
    const guardian = await prisma.user.create({ data: {
      email: 'parent.notify@example.com', name: 'Veli', passwordHash: 'unused', role: 'GUARDIAN', roles: 'GUARDIAN',
    } });
    studentId = student.id;
    guardianId = guardian.id;
    const link = await prisma.guardianLink.create({ data: { studentId, guardianId, emailEnabled: true, smsEnabled: true, phone: '+905551234567' } });
    linkId = link.id;
    report = {
      student: { id: studentId, name: student.name, birthDate: student.birthDate!.toISOString().slice(0, 10) },
      courses: [{ id: 'course', title: 'Matematik', progress: { percent: 50, completedCount: 2, totalLessons: 4 } }],
      grades: [{ courseTitle: 'Matematik', lessonTitle: 'Kesirler', score: 80, gradedAt: new Date().toISOString() }],
      exams: [{ title: 'Dönem sınavı', courseTitle: 'Matematik', score: null, status: 'SUBMITTED', submittedAt: new Date().toISOString() }],
      studySeconds: 7200, generatedAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('sends the linked guardian a real-format email request and records provider acceptance', async () => {
    const result = await sendGuardianReport(linkId, 'EMAIL', report);
    expect(result).toMatchObject({ status: 'SENT', channel: 'EMAIL', providerMessageId: 'email-message-id', error: null });
    expect(result.sentAt).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers['Idempotency-Key']).toBe(`guardian-report/${result.id}`);
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['parent.notify@example.com']);
    expect(body.text).toContain('Matematik: %50 (2/4 ders)');
    expect(body.text).toContain('Kesirler: 80/100');
    expect(body.text).toContain('Sonuç henüz paylaşılmadı');
    expect(body.text).toContain('120 dakika');
  });

  it('sends an SMS to the consented E.164 number using Twilio form encoding', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sid: `SM${'1'.repeat(32)}`, status: 'queued' }), { status: 201 }));
    expect(await sendGuardianReport(linkId, 'SMS', report)).toMatchObject({ status: 'SENT', channel: 'SMS' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/Messages.json');
    const body = new URLSearchParams(options.body);
    expect(body.get('To')).toBe('+905551234567');
    expect(body.get('From')).toBe('+15551234567');
    expect(body.get('Body')).toContain('2/4 ders');
    expect(body.get('Body')).toContain('80/100');
    expect(body.get('Body')).not.toContain('Dönem sınavı');
  });

  it('records missing configuration as failure without calling a provider', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_CONFIGURED', statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.guardianNotification.findFirst({ where: { linkId } })).toMatchObject({ status: 'FAILED', providerMessageId: null, sentAt: null });
  });

  it('records provider failure without leaking the body or secret', async () => {
    fetchMock.mockResolvedValue(new Response('recipient=private@example.com test-secret-never-send', { status: 401 }));
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).rejects.toMatchObject({ code: 'NOTIFICATION_FAILED', statusCode: 502 });
    const notification = await prisma.guardianNotification.findFirstOrThrow({ where: { linkId } });
    expect(notification.status).toBe('FAILED');
    expect(notification.error).not.toMatch(/private@example|test-secret/);
  });

  it('records a network failure without leaking thrown transport errors', async () => {
    fetchMock.mockRejectedValue(new Error('private recipient plus test-sms-secret'));
    await expect(sendGuardianReport(linkId, 'SMS', report)).rejects.toMatchObject({ code: 'NOTIFICATION_FAILED' });
    const notification = await prisma.guardianNotification.findFirstOrThrow({ where: { linkId } });
    expect(notification.error).not.toMatch(/private recipient|test-sms-secret/);
    expect(notification.status).toBe('FAILED');
  });

  it('rejects a successful HTTP response without a valid provider message id', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).rejects.toMatchObject({ code: 'NOTIFICATION_FAILED' });
    expect(await prisma.guardianNotification.findFirst({ where: { linkId } })).toMatchObject({ status: 'FAILED', sentAt: null });
  });

  it('enforces consent without recording or dispatching a message', async () => {
    await prisma.guardianLink.update({ where: { id: linkId }, data: { emailEnabled: false } });
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).rejects.toMatchObject({ code: 'NOTIFICATION_DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.guardianNotification.count({ where: { linkId } })).toBe(0);
    expect((await prisma.guardianLink.findUniqueOrThrow({ where: { id: linkId } })).lastNotificationAt).toBeNull();
  });

  it.each(['adult', 'unknown birthday', 'disabled student', 'disabled guardian', 'removed guardian role', 'removed student role', 'different student'])('rechecks authorization for an existing link: %s', async (change) => {
    if (change === 'adult') await prisma.user.update({ where: { id: studentId }, data: { birthDate: new Date('1990-01-01') } });
    if (change === 'unknown birthday') await prisma.user.update({ where: { id: studentId }, data: { birthDate: null } });
    if (change === 'disabled student') await prisma.user.update({ where: { id: studentId }, data: { disabledAt: new Date() } });
    if (change === 'disabled guardian') await prisma.user.update({ where: { id: guardianId }, data: { disabledAt: new Date() } });
    if (change === 'removed guardian role') await prisma.user.update({ where: { id: guardianId }, data: { roles: 'STUDENT' } });
    if (change === 'removed student role') await prisma.user.update({ where: { id: studentId }, data: { roles: 'INSTRUCTOR' } });
    if (change === 'different student') report.student.id = 'another-child';
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.guardianNotification.count({ where: { linkId } })).toBe(0);
  });

  it('rejects a malformed SMS recipient before calling the provider', async () => {
    await prisma.guardianLink.update({ where: { id: linkId }, data: { phone: '05551234567' } });
    await expect(sendGuardianReport(linkId, 'SMS', report)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only dispatches one of two simultaneous requests', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 'concurrent-email-id' }), { status: 200 }));
    const results = await Promise.allSettled([
      sendGuardianReport(linkId, 'EMAIL', report),
      sendGuardianReport(linkId, 'EMAIL', report),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'NOTIFICATION_RATE_LIMITED' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('atomically reserves cooldown across concurrent sends and channels', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    fetchMock.mockImplementation(async () => { await gate; return new Response(JSON.stringify({ id: 'first-email-id', sid: 'sms-id', status: 'queued' }), { status: 200 }); });
    const first = sendGuardianReport(linkId, 'EMAIL', report);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    try {
      await expect(sendGuardianReport(linkId, 'SMS', report)).rejects.toMatchObject({ code: 'NOTIFICATION_RATE_LIMITED', statusCode: 429 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await first;
    }
    expect(await prisma.guardianNotification.count({ where: { linkId } })).toBe(1);
  });

  it('permits a new send once the shared cooldown expires', async () => {
    await sendGuardianReport(linkId, 'EMAIL', report);
    await prisma.guardianLink.update({ where: { id: linkId }, data: { lastNotificationAt: new Date(Date.now() - 61_000) } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'next-email-id' }), { status: 200 }));
    await expect(sendGuardianReport(linkId, 'EMAIL', report)).resolves.toMatchObject({ status: 'SENT' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
