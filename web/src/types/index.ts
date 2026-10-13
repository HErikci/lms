import type { BadgeTone } from '../components';
import type { ProgressTone } from '../components';
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

/** Haftalık aktivite grafiğinin tek bir günü. */
export interface ActivityDay {
  label: string;
  /** Video izleme süresi, dakika. */
  videoMinutes: number;
  /** Quiz ve görev süresi, dakika. */
  taskMinutes: number;
  isToday: boolean;
  isWeekend: boolean;
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

export interface ContinueLesson {
  courseTitle: string;
  instructor: string;
  lessonNumber: number;
  lessonTopic: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  remainingMinutes: number;
  moduleProgress: number;
}

export interface Course {
  id: string;
  code: string;
  credits: number;
  category: string;
  title: string;
  nextLesson: string;
  progress: number;
  progressTone: ProgressTone;
  thumbnailUrl: string;
  thumbnailAlt: string;
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

/** GET /api/v1/courses ve GET /api/v1/users/me/courses ortak kurs özeti. */
export interface CourseSummary {
  id: string;
  title: string;
  category: string;
  level: string;
  accessMode: CourseAccessMode;
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
}

export interface DashboardData {
  student: StudentProfile;
  term: TermInfo;
  weeklyGoalSummary: string;
  kpis: KpiMetric[];
  continueLesson: ContinueLesson;
  courses: Course[];
  totalCourseCount: number;
  activity: ActivityDay[];
  upcomingTasks: UpcomingTask[];
  aiGuide: AiGuide;
  announcements: Announcement[];
}
