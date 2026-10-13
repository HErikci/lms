import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { RequireAuth } from './RequireAuth';
import { RequireRole } from './RequireRole';
import { RedirectIfAuthed } from './RedirectIfAuthed';
import { DashboardPage } from '../features/dashboard';
import { CoursesPage } from '../features/courses';
import { AnnouncementsPage } from '../features/announcements';
import { CalendarPage } from '../features/calendar';
import { AssignmentsPage } from '../features/assignments';
import { ExamsPage } from '../features/exams';
import { LoginPage } from '../features/auth';
import { ProfilePage } from '../features/profile';
import { AdminCoursesPage, CourseStudentsPage } from '../features/admin/courses';

/**
 * Yollar layout/Sidebar/navItems.ts ile birebir eşleşir.
 * Yeni sayfa eklerken iki dosyayı birlikte güncelle.
 */
export const router = createBrowserRouter([
  {
    element: <RequireAuth />,
    children: [
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
          { path: 'profil', element: <ProfilePage /> },
          {
            element: <RequireRole allow={['ADMIN']} />,
            children: [
              { path: 'yonetim/kurslar', element: <AdminCoursesPage /> },
              { path: 'yonetim/kurslar/:id/ogrenciler', element: <CourseStudentsPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <RedirectIfAuthed />,
    children: [{ path: 'giris', element: <LoginPage /> }],
  },
]);
