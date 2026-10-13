import { PageContainer } from '../../layout/PageContainer';
import { useDashboardData } from '../../data/useDashboardData';
import {
  AiGuideCard,
  AnnouncementsFeed,
  ContinueLearningCard,
  EnrolledCourses,
  KpiGrid,
  UpcomingTasks,
  WeeklyActivityChart,
  WelcomeBanner,
} from './components';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const data = useDashboardData();

  return (
    <PageContainer>
      <WelcomeBanner
        greeting={data.greeting}
        summary={data.weeklyGoalSummary}
        term={data.term}
        activity={data.activity}
      />

      <KpiGrid metrics={data.kpis} />

      <div className={styles.columns}>
        <div className={styles.primary}>
          <ContinueLearningCard lesson={data.continueLesson} />
          <EnrolledCourses courses={data.courses} totalCount={data.totalCourseCount} />
          <WeeklyActivityChart activity={data.activity} />
        </div>

        <div className={styles.secondary}>
          <UpcomingTasks tasks={data.upcomingTasks} />
          <AiGuideCard guide={data.aiGuide} />
          <AnnouncementsFeed announcements={data.announcements} />
        </div>
      </div>
    </PageContainer>
  );
}
