import type { ContentType } from '../../types';
import type { BadgeTone } from '../../components';

/** İçerik türü → Türkçe etiket, ikon ve rozet tonu. İki ekranda da (öğrenci kurs detayı,
 * yönetici içerik yönetimi) ortak kullanılır ki eşleme tek yerde tutulsun. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO_YOUTUBE: 'Video',
  DOCUMENT: 'Doküman',
  QUIZ: 'Sınav',
  LINK: 'Bağlantı',
  TEXT: 'Metin',
};

export const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  VIDEO_YOUTUBE: 'play_circle',
  DOCUMENT: 'description',
  QUIZ: 'quiz',
  LINK: 'link',
  TEXT: 'article',
};

export const CONTENT_TYPE_BADGE_TONES: Record<ContentType, BadgeTone> = {
  VIDEO_YOUTUBE: 'info',
  DOCUMENT: 'neutral',
  QUIZ: 'warning',
  LINK: 'cyan',
  TEXT: 'neutral',
};

export const CONTENT_TYPE_OPTIONS: ContentType[] = [
  'VIDEO_YOUTUBE',
  'DOCUMENT',
  'QUIZ',
  'LINK',
  'TEXT',
];
