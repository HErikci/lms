import type { BadgeTone } from '../components';
import type { StatTone } from '../components';

export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  avatarUrl: string | null;
  locale: string;
  createdAt: string;
}

export interface StudentProfile {
  fullName: string;
  studentNumber: string;
  avatarUrl?: string;
}

export interface TermInfo {
  label: string;
  streakDays: number;
  weeklyGoalHours: number;
  minutesCompletedToday: number;
  weeklyGoalProgress: number;
}

/** Haftalık aktivite grafiğinin tek bir günü (GET /api/v1/users/me/activity'den türetilir). */
export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  /** Kısa gün adı; bugün için "Bugün". */
  label: string;
  /** Video derslerde geçen süre, dakika. */
  videoMinutes: number;
  /** Doküman, bağlantı, metin ve quiz derslerinde geçen süre, dakika. */
  otherMinutes: number;
  isToday: boolean;
}

/** GET /api/v1/users/me/activity yanıtındaki tek gün. */
export interface StudyActivityDay {
  date: string;
  videoSeconds: number;
  quizSeconds: number;
  readingSeconds: number;
  totalSeconds: number;
}

/** GET /api/v1/users/me/activity yanıtı. */
export interface StudyActivityReport {
  timezone: string;
  /** YYYY-MM-DD, sunucunun takvimine göre bugün. */
  today: string;
  days: StudyActivityDay[];
  totals: { todaySeconds: number; rangeSeconds: number; monthSeconds: number };
  streakDays: number;
}

/** GET /api/v1/users/me/grades yanıtındaki özet; not yoksa sayısal alanlar null gelir. */
export interface GradeSummary {
  /** Yuvarlanmış tam sayı; hiç not yoksa null. */
  averageScore: number | null;
  /** AA, BA, BB, CB, CC, DC, DD, FD, FF */
  letterGrade: string | null;
  /** Yüksek, İyi, Orta, Düşük */
  level: string | null;
  gradeCount: number;
  lastScore: number | null;
  /** Son not − diğer notların ortalaması; gradeCount < 2 ise null. */
  trend: number | null;
}

/** Öğrencinin tek bir quiz notu (gradedAt'e göre yeniden eskiye sıralı gelir). */
export interface MyGrade {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  score: number;
  gradedAt: string;
}

/** GET /api/v1/users/me/grades yanıtı. */
export interface MyGradesReport {
  summary: GradeSummary;
  grades: MyGrade[];
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  icon: string;
  iconTone: StatTone;
  /** Değerin altındaki açıklama satırı. */
  footnote?: string;
  footnoteIcon?: string;
  /** Verildiğinde dipnot yerine ilerleme çubuğu çizilir. */
  progress?: number;
}

export type TaskKind = 'assignment' | 'exam' | 'lab';

export interface UpcomingTask {
  id: string;
  kind: TaskKind;
  /** Sol üstteki tür/öncelik etiketi. */
  tagLabel: string;
  tagTone: BadgeTone;
  tagIcon?: string;
  /** Sağ üstteki kalan süre bilgisi. */
  dueLabel: string;
  title: string;
  description: string;
  metaIcon: string;
  metaLabel: string;
  durationLabel?: string;
  actionLabel: string;
}

export interface Announcement {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  /** Okunmamış/yeni durumunu gösteren nokta rengi. */
  tone: 'secondary' | 'cyan' | 'muted';
}

export interface AiGuide {
  title: string;
  status: string;
  message: string;
  highlight: string;
  ctaLabel: string;
}

export type CourseAccessMode = 'SEQUENTIAL' | 'FREE';

/** Kurs tamamlanma özeti (users/me/courses öğelerinde). */
export interface CourseProgress {
  percent: number;
  completedCount: number;
  totalLessons: number;
}

/** Kurs tamamlanma detayı (courses/:id ve lessons/:id/completion yanıtlarında). */
export interface CourseProgressDetail extends CourseProgress {
  courseId: string;
  completedLessonIds: string[];
}

/** Kursa atanmış eğitmen (position'a göre sıralı; ilk eleman baş eğitmen). */
export interface CourseInstructor {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: number;
}

/** GET /api/v1/courses ve GET /api/v1/users/me/courses ortak kurs özeti. */
export interface CourseSummary {
  id: string;
  title: string;
  category: string;
  level: string;
  accessMode: CourseAccessMode;
  /** Yalnızca users/me/courses yanıtında gelir. */
  progress?: CourseProgress;
  instructors?: CourseInstructor[];
  /** Sıradaki tamamlanmamış ders; hepsi bittiyse null. */
  nextLesson?: CourseNextLesson | null;
  moduleCount?: number;
}

export interface CourseNextLesson {
  id: string;
  title: string;
  contentType: ContentType;
  contentUrl: string | null;
}

export type ContentType = 'VIDEO_YOUTUBE' | 'DOCUMENT' | 'QUIZ' | 'LINK' | 'TEXT';

export interface CourseLessonSummary {
  id: string;
  title: string;
  description: string | null;
  contentType: ContentType;
  contentUrl: string | null;
  order: number;
  status: string;
}

export interface CourseModuleSummary {
  id: string;
  title: string;
  order: number;
  lessons: CourseLessonSummary[];
}

/** GET /api/v1/courses/:id yanıtı. */
export interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  tags: string[];
  accessMode: CourseAccessMode;
  status: string;
  /** Öğrenci bu kursa kayıtlı mı; false ise modules boş döner. */
  isEnrolled: boolean;
  modules: CourseModuleSummary[];
  /** Yalnızca isEnrolled true iken gelir. */
  progress?: CourseProgressDetail;
  instructors?: CourseInstructor[];
}

export interface DashboardData {
  student: StudentProfile;
  term: TermInfo;
  weeklyGoalSummary: string;
  kpis: KpiMetric[];
  upcomingTasks: UpcomingTask[];
  aiGuide: AiGuide;
  announcements: Announcement[];
}

export interface MyLessonFeedback {
  liked: boolean;
  rating: number | null;
}

export interface LessonFeedback {
  likeCount: number;
  ratingCount: number;
  ratingAverage: number | null;
  mine: MyLessonFeedback;
}

/** Takvim etkinliği türü; renk ve simge bu türe göre seçilir. */
export type CalendarEventType = 'lecture' | 'lab' | 'exam' | 'deadline' | 'holiday' | 'event';

/** Akademik takvim etkinliği (GET /api/v1/calendar/events yanıtı). */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  /** Tüm gün etkinliklerde YYYY-MM-DD; zamanlı etkinliklerde ISO 8601 UTC. */
  start: string;
  /** Tüm gün etkinliklerde bitiş günü hariçtir (exclusive). */
  end: string | null;
  allDay: boolean;
  location: string | null;
  course: { id: string; title: string } | null;
  /** Mevcut kullanıcı bu etkinliği düzenleyip silebilir mi. */
  canEdit: boolean;
}
