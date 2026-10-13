import { useEffect, useRef } from 'react';

/** Bir dersin otomatik tamamlandı sayılması için sayfada geçirilmesi gereken süre. */
export const AUTO_COMPLETE_MS = 60_000;

/**
 * `enabled` iken ders sayfası görünür durumda `AUTO_COMPLETE_MS` kadar açık kalırsa
 * `onComplete` bir kez çağrılır. Sekme arka plandayken süre işlemez; ders değişince sayaç sıfırlanır.
 */
export function useLessonAutoComplete(
  lessonId: string | undefined,
  enabled: boolean,
  onComplete: (lessonId: string) => void,
) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled || !lessonId) return;

    let elapsed = 0;
    let startedAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      if (startedAt !== null) return;
      startedAt = Date.now();
      timer = setTimeout(() => onCompleteRef.current(lessonId), AUTO_COMPLETE_MS - elapsed);
    };
    const pause = () => {
      if (startedAt === null) return;
      elapsed += Date.now() - startedAt;
      startedAt = null;
      clearTimeout(timer);
    };
    const onVisibilityChange = () => (document.visibilityState === 'visible' ? start() : pause());

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(timer);
    };
  }, [lessonId, enabled]);
}
