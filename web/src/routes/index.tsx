import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { DashboardPage } from '../features/dashboard';
import { CoursesPage } from '../features/courses';
import { AnnouncementsPage } from '../features/announcements';
import { CalendarPage } from '../features/calendar';
import { AssignmentsPage } from '../features/assignments';
import { ExamsPage } from '../features/exams';

/**
 * Yollar layout/Sidebar/navItems.ts ile birebir eşleşir.
 * Yeni sayfa eklerken iki dosyayı birlikte güncelle.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'kurslarim', element: <CoursesPage /> },
      { path: 'duyurular', element: <AnnouncementsPage /> },
      { path: 'takvim', element: <CalendarPage /> },
      { path: 'notlar-ve-gorevler', element: <AssignmentsPage /> },
      { path: 'sinavlar', element: <ExamsPage /> },
    ],
  },
]);
