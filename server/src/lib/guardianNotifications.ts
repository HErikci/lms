import type { GuardianNotification } from '@prisma/client';
import { AppError } from '../errors.js';
import { prisma } from './prisma.js';
import { isMinor, type GuardianReport } from './guardians.js';

export type GuardianChannel = 'EMAIL' | 'SMS';

const COOLDOWN_MS = 60_000;
const E164 = /^\+[1-9]\d{7,14}$/;
const FAILED_MESSAGE = 'Bildirim sağlayıcısı gönderimi kabul etmedi. Yapılandırmayı ve sağlayıcı panelini kontrol edin.';

function hasRole(user: { role: string; roles: string }, role: string) {
  return (user.roles || user.role).split(',').map((value) => value.trim()).includes(role);
}

function serialize(notification: GuardianNotification) {
  return {
    id: notification.id,
    linkId: notification.linkId,
    channel: notification.channel,
    status: notification.status,
    error: notification.error,
    providerMessageId: notification.providerMessageId,
    createdAt: notification.createdAt.toISOString(),
    sentAt: notification.sentAt?.toISOString() ?? null,
  };
}

function plain(value: string, limit = 200) {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

function emailText(report: GuardianReport) {
  return [
    `${plain(report.student.name)} — öğrenci gelişim raporu`,
    `Rapor zamanı: ${report.generatedAt}`,
    `Son 7 günlük çalışma: ${Math.floor(report.studySeconds / 60)} dakika`,
    '',
    'Kurs ilerlemesi:',
    ...report.courses.map((course) => `${plain(course.title)}: %${course.progress.percent} (${course.progress.completedCount}/${course.progress.totalLessons} ders)`),
    '',
    'Ders notları:',
    ...report.grades.map((grade) => `${plain(grade.courseTitle)} / ${plain(grade.lessonTitle)}: ${grade.score}/100`),
    '',
    'Sınavlar:',
    ...report.exams.map((exam) => `${plain(exam.courseTitle)} / ${plain(exam.title)}: ${exam.score === null ? 'Sonuç henüz paylaşılmadı' : `${exam.score}/100`} (${plain(exam.status)})`),
  ].join('\n');
}

function smsText(report: GuardianReport) {
  const completed = report.courses.reduce((total, course) => total + course.progress.completedCount, 0);
  const lessons = report.courses.reduce((total, course) => total + course.progress.totalLessons, 0);
  const scores = [...report.grades.map((grade) => grade.score), ...report.exams.flatMap((exam) => exam.score === null ? [] : [exam.score])];
  const average = scores.length ? `${Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)}/100` : 'henüz yok';
  return `BTK öğrenci raporu: ${plain(report.student.name, 80)}. ${report.courses.length} kurs, ${completed}/${lessons} ders tamamlandı. Not ortalaması: ${average}. Son 7 gün çalışma: ${Math.floor(report.studySeconds / 60)} dk. Ayrıntılar veli panelinde.`;
}

type DeliveryConfig =
  | { channel: 'EMAIL'; key: string; from: string }
  | { channel: 'SMS'; sid: string; token: string; from: string };

function configuration(channel: GuardianChannel): DeliveryConfig {
  if (channel === 'EMAIL') {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.GUARDIAN_EMAIL_FROM?.trim();
    if (!key || !from) {
      throw new AppError('NOTIFICATION_NOT_CONFIGURED', 'E-posta için RESEND_API_KEY ve GUARDIAN_EMAIL_FROM sunucuda tanımlanmalıdır.', 503);
    }
    return { channel, key, from };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  if (!sid || !/^AC[0-9a-f]{32}$/i.test(sid) || !token || !from || !E164.test(from)) {
    throw new AppError('NOTIFICATION_NOT_CONFIGURED', 'SMS için TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN ve E.164 biçiminde TWILIO_SMS_FROM sunucuda tanımlanmalıdır.', 503);
  }
  return { channel, sid, token, from };
}

async function deliver(config: DeliveryConfig, notificationId: string, recipient: string, report: GuardianReport) {
  const signal = AbortSignal.timeout(15_000);
  const response = config.channel === 'EMAIL'
    ? await fetch('https://api.resend.com/emails', {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `guardian-report/${notificationId}` },
      body: JSON.stringify({ from: config.from, to: [recipient], subject: `${plain(report.student.name, 80)} — öğrenci gelişim raporu`, text: emailText(report) }),
    })
    : await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`, {
      method: 'POST', signal,
      headers: { Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: config.from, To: recipient, Body: smsText(report) }).toString(),
    });
  // Provider bodies may include recipient details or credentials; never retain their errors.
  if (!response.ok) throw new AppError('NOTIFICATION_FAILED', FAILED_MESSAGE, 502);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new AppError('NOTIFICATION_FAILED', FAILED_MESSAGE, 502);
  const data = payload as Record<string, unknown>;
  const messageId = config.channel === 'EMAIL' ? data.id : data.sid;
  if (typeof messageId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(messageId)
      || (config.channel === 'SMS' && ['failed', 'undelivered', 'canceled'].includes(String(data.status)))) {
    throw new AppError('NOTIFICATION_FAILED', FAILED_MESSAGE, 502);
  }
  return messageId;
}

/** Records provider acceptance; SENT is not a device/inbox delivery receipt. */
export async function sendGuardianReport(linkId: string, channel: GuardianChannel, report: GuardianReport) {
  if (channel !== 'EMAIL' && channel !== 'SMS') {
    throw new AppError('VALIDATION_ERROR', 'Bildirim kanalı EMAIL veya SMS olmalıdır.', 400);
  }
  const reservation = await prisma.$transaction(async (tx) => {
    // This conditional write reserves the link across both channels, including concurrent requests.
    // The transaction rolls back the reservation if eligibility or consent validation fails.
    const now = new Date();
    const claimed = await tx.guardianLink.updateMany({
      where: { id: linkId, OR: [{ lastNotificationAt: null }, { lastNotificationAt: { lte: new Date(now.getTime() - COOLDOWN_MS) } }] },
      data: { lastNotificationAt: now },
    });
    const link = await tx.guardianLink.findUnique({ where: { id: linkId }, include: { guardian: true, student: true } });
    if (!link) throw new AppError('NOT_FOUND', 'Veli bağlantısı bulunamadı.', 404);
    if (link.student.disabledAt || link.guardian.disabledAt || !hasRole(link.student, 'STUDENT') || !hasRole(link.guardian, 'GUARDIAN') || !isMinor(link.student.birthDate)) {
      throw new AppError('FORBIDDEN', 'Bildirim yalnızca aktif veliye bağlı, reşit olmayan aktif öğrenciler için gönderilebilir.', 403);
    }
    if (report.student.id !== link.studentId) throw new AppError('FORBIDDEN', 'Rapor bu veli bağlantısındaki öğrenciye ait değil.', 403);
    if (!(channel === 'EMAIL' ? link.emailEnabled : link.smsEnabled)) {
      throw new AppError('NOTIFICATION_DISABLED', 'Veli bu bildirim kanalını etkinleştirmemiş.', 400);
    }
    const recipient = channel === 'EMAIL' ? link.guardian.email : link.phone;
    if (!recipient || (channel === 'SMS' && !E164.test(recipient))) {
      throw new AppError('VALIDATION_ERROR', 'Veli için geçerli bir bildirim adresi veya E.164 telefon numarası tanımlanmalıdır.', 400);
    }
    if (claimed.count === 0) throw new AppError('NOTIFICATION_RATE_LIMITED', 'Bu veli ve öğrenci için yeni bildirim göndermeden önce 60 saniye bekleyin.', 429);
    const notification = await tx.guardianNotification.create({ data: { linkId, channel } });
    return { notification, recipient };
  });

  let providerMessageId: string;
  try {
    providerMessageId = await deliver(configuration(channel), reservation.notification.id, reservation.recipient, report);
  } catch (error) {
    const failure = error instanceof AppError ? error : new AppError('NOTIFICATION_FAILED', 'Bildirim sağlayıcısına ulaşılamadı veya yanıt doğrulanamadı. Sağlayıcı panelini kontrol edin.', 502);
    await prisma.guardianNotification.update({ where: { id: reservation.notification.id }, data: { status: 'FAILED', error: failure.message } });
    throw failure;
  }
  const notification = await prisma.guardianNotification.update({
    where: { id: reservation.notification.id },
    data: { status: 'SENT', providerMessageId, sentAt: new Date(), error: null },
  });
  return serialize(notification);
}
