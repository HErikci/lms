import { useEffect } from 'react';
import { ApiError, apiFetch } from '../../lib/apiClient';

/** Biriken süre bu kadar saniyeye ulaşınca sunucuya gönderilir. */
export const STUDY_FLUSH_SECONDS = 60;

/** Bu süre boyunca hiç etkileşim olmazsa (fare, klavye, kaydırma, dokunma) sayaç durur. */
export const STUDY_IDLE_MS = 30 * 60 * 1000;

const INTERACTION_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/**
 * Ders sayfasında geçen çalışma süresini ölçer ve POST /api/v1/users/me/activity ile bildirir.
 *
 * Yalnızca sekme görünürken ve kullanıcı STUDY_IDLE_MS'ten uzun süredir hareketsiz değilken
 * saniye sayılır. Süre ~60 sn'de bir, ayrıca sekme gizlenince, sayfa kapanınca ve ders
 * değişince gönderilir. Ağ hatasında süre kaybolmaz, bir sonraki gönderime eklenir.
 */
export function useStudyTracker(lessonId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !lessonId) return;

    let pendingSeconds = 0;
    let lastInteraction = Date.now();

    const flush = (keepalive = false) => {
      if (pendingSeconds < 1) return;
      const seconds = pendingSeconds;
      pendingSeconds = 0;
      apiFetch('/api/v1/users/me/activity', {
        method: 'POST',
        body: JSON.stringify({ lessonId, seconds }),
        // Sayfa kapanırken de isteğin tamamlanabilmesi için.
        keepalive,
      }).catch((err) => {
        // Sunucunun reddettiği (ör. 403/404) süre tekrar denenmez; ağ hatasında geri eklenir.
        if (!(err instanceof ApiError)) pendingSeconds += seconds;
      });
    };

    const tick = window.setInterval(() => {
      const active = document.visibilityState === 'visible' && Date.now() - lastInteraction < STUDY_IDLE_MS;
      if (!active) return;
      pendingSeconds += 1;
      if (pendingSeconds >= STUDY_FLUSH_SECONDS) flush();
    }, 1000);

    const markInteraction = () => {
      lastInteraction = Date.now();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush(true);
      else markInteraction();
    };
    const onPageHide = () => flush(true);

    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, markInteraction, { passive: true });
    }
    // Gömülü videoya (iframe) tıklamak pencereden odak kaybı olarak gelir; izleme etkileşimi sayılır.
    window.addEventListener('blur', markInteraction);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(tick);
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, markInteraction);
      }
      window.removeEventListener('blur', markInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      flush(true);
    };
  }, [lessonId, enabled]);
}
