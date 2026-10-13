import { Badge, Card, Icon, Text } from '../../components';
import { PageContainer } from '../../layout/PageContainer';
import styles from './AnnouncementsPage.module.css';

interface Announcement {
  id: string;
  title: string;
  category: string;
  date: string;
  source: string;
  icon: string;
  tone: 'secondary' | 'cyan' | 'warning' | 'muted';
}

const announcements: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Güz Dönemi Ara Sınav Takvimi Resmi Olarak Yayınlandı',
    category: 'Akademik',
    date: '3 saat önce',
    source: 'Öğrenci İşleri',
    icon: 'calendar_today',
    tone: 'secondary',
  },
  {
    id: 'ann-2',
    title: 'Canlı Soru-Cevap Oturumu: Yapay Zekâ Projesi (Perşembe 19:00)',
    category: 'Ders',
    date: 'Dün',
    source: 'Doç. Dr. Fatih Kaya',
    icon: 'video_call',
    tone: 'cyan',
  },
  {
    id: 'ann-3',
    title: 'Kampüs Kütüphanesi Dijital Veritabanı Bakımı Tamamlandı',
    category: 'Bilgi İşlem',
    date: '2 gün önce',
    source: 'Bilgi İşlem Daire Bşk.',
    icon: 'library_books',
    tone: 'muted',
  },
  {
    id: 'ann-4',
    title: 'Veri Yapıları Proje Ödevi 2 Teslim Tarihi Uzatıldı (27 Ekim → 30 Ekim)',
    category: 'Ders',
    date: '5 gün önce',
    source: 'Prof. Ahmet Yılmaz',
    icon: 'assignment',
    tone: 'warning',
  },
  {
    id: 'ann-5',
    title: 'Bahar 2025 Ders Seçim Dönemi: 15 Kasım - 22 Kasım',
    category: 'Akademik',
    date: '1 hafta önce',
    source: 'Öğrenci İşleri',
    icon: 'school',
    tone: 'secondary',
  },
];

export function AnnouncementsPage() {
  return (
    <PageContainer>
      <div className={styles.header}>
        <Text role="headline-lg" as="h1">
          Duyurular
        </Text>
        <Text role="body-md" tone="muted" as="p">
          {announcements.length} duyuru · En son 3 saat önce
        </Text>
      </div>

      <div className={styles.list}>
        {announcements.map((ann) => (
          <Card key={ann.id} padding="lg" elevation="1">
            <a href="#" className={styles.announcementItem}>
              <div className={styles.iconSection}>
                <span className={styles[`icon-${ann.tone}`]}>
                  <Icon name={ann.icon} size="md" filled />
                </span>
              </div>

              <div className={styles.content}>
                <div className={styles.titleBar}>
                  <Text role="title-md" as="h2" tone="main">
                    {ann.title}
                  </Text>
                  <Badge tone={ann.tone} variant="soft">
                    {ann.category}
                  </Badge>
                </div>

                <Text role="body-sm" tone="muted">
                  {ann.source} · {ann.date}
                </Text>
              </div>

              <Icon name="arrow_forward" size="sm" />
            </a>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
