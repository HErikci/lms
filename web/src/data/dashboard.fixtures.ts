import type { DashboardData } from '../types';
import { IMAGE_1, IMAGE_2, IMAGE_3, IMAGE_4 } from './images';

/**
 * Dashboard için sahte veri. İçerik ui/code.html'deki gerçek Türkçe metinlerden alındı.
 * Backend hazır olduğunda bu dosya yerini API yanıtına bırakır; bileşenler değişmez.
 */
export const dashboardFixture: DashboardData = {
  student: {
    fullName: 'Deniz Akın',
    studentNumber: '202484019',
  },
  term: {
    label: '2024-2025 Güz Dönemi',
    streakDays: 5,
    weeklyGoalHours: 6,
    minutesCompletedToday: 48,
    weeklyGoalProgress: 78,
  },
  weeklyGoalSummary:
    'Harika gidiyorsun! Bu hafta hedeflerinin %78’ini tamamladın. Bugün modern mimari modülünü bitirerek haftalık rozeti kazanabilirsin.',

  kpis: [
    {
      id: 'enrolled',
      label: 'Kayıtlı Kurslar',
      value: '4',
      unit: 'Aktif Dönem',
      icon: 'menu_book',
      iconTone: 'secondary',
      footnote: '2 yeni atanan ders',
      footnoteIcon: 'arrow_upward',
    },
    {
      id: 'completed',
      label: 'Tamamlanan Dersler',
      value: '42',
      unit: '/62   %68',
      icon: 'check_circle',
      iconTone: 'secondary',
      progress: 68,
    },
    {
      id: 'average',
      label: 'Ortalama Başarı',
      value: '%84',
      unit: 'AA / Yüksek',
      icon: 'military_tech',
      iconTone: 'success',
      footnote: 'Son quizden +%6 artış',
      footnoteIcon: 'trending_up',
    },
    {
      id: 'studytime',
      label: 'Çalışma Süresi',
      value: '28.5',
      unit: 'Saat / Bu Ay',
      icon: 'timer',
      iconTone: 'cyan',
      footnote: 'Aylık hedef: 35 Saat',
      footnoteIcon: 'schedule',
    },
  ],

  continueLesson: {
    courseTitle: 'Web Teknolojileri',
    instructor: 'Dr. Murat Yılmaz',
    lessonNumber: 14,
    lessonTopic: 'REST API',
    title: 'Modern Web Geliştirme: Full Stack React & Node.js',
    description:
      'Modül 3: REST API Mimarisi, Express.js Router Yapılandırması ve PostgreSQL Veritabanı…',
    thumbnailUrl: IMAGE_1,
    thumbnailAlt:
      'Kod editörü ve geliştirme panosu açık bir monitörün bulunduğu çalışma masası',
    remainingMinutes: 18,
    moduleProgress: 72,
  },

  totalCourseCount: 4,
  courses: [
    {
      id: 'ceng201',
      code: 'CENG 201',
      credits: 4,
      category: 'Bilgisayar Müh.',
      title: 'Veri Yapıları ve Algoritmalar',
      nextLesson: 'İkili Arama Ağaçları',
      progress: 85,
      progressTone: 'cyan',
      thumbnailUrl: IMAGE_2,
      thumbnailAlt: 'Mavi tonlarda ağ düğümlerinden oluşan soyut veri yapısı görseli',
    },
    {
      id: 'ai304',
      code: 'AI 304',
      credits: 3,
      category: 'Yapay Zekâ',
      title: 'Yapay Zekâ ve ML Temelleri',
      nextLesson: 'Denetimli Öğrenme',
      progress: 40,
      progressTone: 'blue',
      thumbnailUrl: IMAGE_3,
      thumbnailAlt: 'Sinir ağı bağlantılarını gösteren mavi renkli görselleştirme',
    },
    {
      id: 'swe212',
      code: 'SWE 212',
      credits: 4,
      category: 'Yazılım',
      title: 'Veritabanı Sistemleri & SQL',
      nextLesson: 'İndeksleme Stratejileri',
      progress: 90,
      progressTone: 'success',
      thumbnailUrl: IMAGE_4,
      thumbnailAlt: 'Veri merkezi sunucularını temsil eden izometrik mavi blok görseli',
    },
  ],

  activity: [
    { label: 'Pzt', videoMinutes: 38, taskMinutes: 22, isToday: false, isWeekend: false },
    { label: 'Sal', videoMinutes: 58, taskMinutes: 18, isToday: false, isWeekend: false },
    { label: 'Çar', videoMinutes: 52, taskMinutes: 12, isToday: false, isWeekend: false },
    { label: 'Per', videoMinutes: 34, taskMinutes: 26, isToday: false, isWeekend: false },
    { label: 'Bugün', videoMinutes: 66, taskMinutes: 42, isToday: true, isWeekend: false },
    { label: 'Cmt', videoMinutes: 10, taskMinutes: 0, isToday: false, isWeekend: true },
    { label: 'Paz', videoMinutes: 16, taskMinutes: 0, isToday: false, isWeekend: true },
  ],

  upcomingTasks: [
    {
      id: 'task-1',
      kind: 'assignment',
      tagLabel: 'Yüksek Öncelik',
      tagTone: 'error',
      tagIcon: 'priority_high',
      dueLabel: '2 gün kaldı',
      title: 'Veri Yapıları Proje Ödevi 2',
      description: 'Dengeli Ağaç (AVL Tree) Gerçekleştirimi',
      metaIcon: 'schedule',
      metaLabel: '27 Ekim 23:59',
      actionLabel: 'Teslim Et',
    },
    {
      id: 'task-2',
      kind: 'exam',
      tagLabel: 'Çevrim İçi Sınav',
      tagTone: 'brand',
      tagIcon: 'quiz',
      dueLabel: 'Cuma 14:00',
      title: 'SQL Ara Sınavı (Online Quiz)',
      description: 'Modül 1-4 Kapsamı · 25 Çoktan Seçmeli Soru',
      metaIcon: 'timelapse',
      metaLabel: '45 Dakika Süre',
      durationLabel: 'Henüz Başlamadı',
      actionLabel: 'Detaylar',
    },
    {
      id: 'task-3',
      kind: 'lab',
      tagLabel: 'Laboratuvar',
      tagTone: 'neutral',
      dueLabel: '5 gün kaldı',
      title: 'Yapay Zekâ Mini Proje Teslimi',
      description: 'Lineer Regresyon ile Tahminleme Notebook’u',
      metaIcon: 'schedule',
      metaLabel: '31 Ekim 17:00',
      actionLabel: 'Detaylar',
    },
  ],

  aiGuide: {
    title: 'Yapay Zekâ Ders Rehberi',
    status: 'Aktif ve Hazır',
    // `highlight` bu cümlenin içinde birebir geçmelidir; AiGuideCard metni
    // bu değere göre bölerek ortadaki kısmı vurgular.
    message:
      'SQL Ara Sınavı öncesi eksik olduğun konular tespit edildi: GROUP BY & HAVING konularında 5 pratik soru çözmek ister misin?',
    highlight: 'GROUP BY & HAVING',
    ctaLabel: 'Hızlı Quiz Başlat',
  },

  announcements: [
    {
      id: 'ann-1',
      title: 'Güz Dönemi Ara Sınav Takvimi Güncellendi',
      source: 'Öğrenci İşleri',
      timeAgo: '3 saat önce',
      tone: 'secondary',
    },
    {
      id: 'ann-2',
      title: 'Canlı Soru-Cevap Oturumu: Perşembe 19:00',
      source: 'Dr. Murat Yılmaz',
      timeAgo: 'Dün',
      tone: 'cyan',
    },
    {
      id: 'ann-3',
      title: 'Kampüs Kütüphanesi Dijital Veritabanı Bakımı',
      source: 'Bilgi İşlem Daire Bşk.',
      timeAgo: '2 gün önce',
      tone: 'muted',
    },
  ],
};
