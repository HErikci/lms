import type { BadgeTone } from '../../../components';
import type { UserRole } from '../../../types';

/** Sunucudaki kanonik sırayla (en az yetkiliden en çoğa). */
export const ROLE_OPTIONS: { value: UserRole; label: string; tone: BadgeTone; hint: string }[] = [
  { value: 'STUDENT', label: 'Öğrenci', tone: 'neutral', hint: 'Kurslara kaydolur ve ders içeriklerini izler.' },
  { value: 'GUARDIAN', label: 'Veli', tone: 'secondary', hint: 'Yönetici tarafından bağlanan çocuğunun eğitim bilgilerini görür ve rapor alır.' },
  { value: 'INSTRUCTOR', label: 'Eğitmen', tone: 'cyan', hint: 'Atandığı kursların içeriğini, notlarını ve duyurularını yönetir.' },
  { value: 'ADMIN', label: 'Yönetici', tone: 'navy', hint: 'Tüm kursları, kullanıcıları ve sistem ayarlarını yönetir.' },
];

export const ROLE_META = Object.fromEntries(ROLE_OPTIONS.map((option) => [option.value, option])) as Record<
  UserRole,
  (typeof ROLE_OPTIONS)[number]
>;

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Karışması kolay karakterler (0/O, 1/l/I) olmadan 12 karakterlik geçici şifre. */
export function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join('');
}
