import type { BadgeTone } from '../../../components';
import type { QuestionDifficulty, QuestionType } from '../../../types';

export const QUESTION_TYPES: Record<QuestionType, { label: string; short: string; icon: string; hint: string }> = {
  SINGLE_CHOICE: {
    label: 'Çoktan seçmeli (tek cevap)',
    short: 'Tek cevap',
    icon: 'radio_button_checked',
    hint: 'Seçeneklerden yalnızca biri doğrudur.',
  },
  MULTIPLE_CHOICE: {
    label: 'Çoktan seçmeli (çok cevap)',
    short: 'Çok cevap',
    icon: 'check_box',
    hint: 'Birden fazla seçenek doğru olabilir; en az biri doğru işaretlenmelidir.',
  },
  TRUE_FALSE: {
    label: 'Doğru / Yanlış',
    short: 'Doğru/Yanlış',
    icon: 'rule',
    hint: 'Önermenin doğru mu yanlış mı olduğu sorulur.',
  },
  FILL_BLANK: {
    label: 'Boşluk doldurma',
    short: 'Boşluk doldurma',
    icon: 'short_text',
    hint: 'Metindeki her ___ (en az üç alt çizgi) bir boşluktur; her boşluk için kabul edilen cevapları yazın.',
  },
  MATCHING: {
    label: 'Eşleştirme',
    short: 'Eşleştirme',
    icon: 'compare_arrows',
    hint: 'Soldaki öğeler sağdakilerle eşleştirilir; sınavda sağ taraf karıştırılarak gösterilir.',
  },
  SHORT_ANSWER: {
    label: 'Kısa cevap',
    short: 'Kısa cevap',
    icon: 'edit',
    hint: 'Öğrencinin yazdığı metin kabul edilen cevaplardan biriyle eşleşirse doğru sayılır.',
  },
  ESSAY: {
    label: 'Açık uçlu',
    short: 'Açık uçlu',
    icon: 'subject',
    hint: 'Uzun cevaplıdır; eğitmen rubriğe göre elle puanlar.',
  },
};

export const QUESTION_TYPE_KEYS = Object.keys(QUESTION_TYPES) as QuestionType[];

export const DIFFICULTIES: Record<QuestionDifficulty, { label: string; tone: BadgeTone }> = {
  EASY: { label: 'Kolay', tone: 'success' },
  MEDIUM: { label: 'Orta', tone: 'warning' },
  HARD: { label: 'Zor', tone: 'error' },
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES) as QuestionDifficulty[];

/** Boşluk doldurma işareti: en az üç alt çizgi (sunucudaki kuralla aynı). */
export const BLANK_PATTERN = /_{3,}/g;

export function countBlanks(stem: string): number {
  return stem.match(BLANK_PATTERN)?.length ?? 0;
}

/** Türkçe büyük/küçük harf kurallarıyla arama anahtarı. */
export function searchKey(value: string): string {
  return value.toLocaleLowerCase('tr');
}
