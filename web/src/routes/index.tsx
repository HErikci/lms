import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../layout/AppShell';
import { DashboardPage } from '../features/dashboard';
import { PlaceholderPage } from './PlaceholderPage';

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
      {
        path: 'kurslarim',
        element: (
          <PlaceholderPage
            title="Kurslarım / Dersler"
            icon="school"
            promise="Kayıtlı olduğun tüm kursları, modül yapısını ve ders içeriklerini buradan yöneteceksin."
          />
        ),
      },
      {
        path: 'duyurular',
        element: (
          <PlaceholderPage
            title="Duyurular"
            icon="campaign"
            promise="Öğrenci işleri ve eğitmenlerinden gelen tüm duyuruları buradan takip edeceksin."
          />
        ),
      },
      {
        path: 'takvim',
        element: (
          <PlaceholderPage
            title="Takvim"
            icon="calendar_today"
            promise="Canlı dersleri, sınav tarihlerini ve ödev teslimlerini aylık takvimde göreceksin."
          />
        ),
      },
      {
        path: 'notlar-ve-gorevler',
        element: (
          <PlaceholderPage
            title="Notlar & Görevler"
            icon="assignment_turned_in"
            promise="Ödevlerini teslim edecek, eğitmen geri bildirimlerini ve notlarını buradan göreceksin."
          />
        ),
      },
      {
        path: 'sinavlar',
        element: (
          <PlaceholderPage
            title="Sınav Sistemi"
            icon="quiz"
            promise="Çevrim içi sınavlara buradan gireceksin; sonuçların ve konu bazlı analizin burada toplanacak."
          />
        ),
      },
    ],
  },
]);
