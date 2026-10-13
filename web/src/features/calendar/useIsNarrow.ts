import { useEffect, useState } from 'react';

/** Mobil kırılım noktası (CLAUDE.md: <768px). */
const NARROW_QUERY = '(max-width: 767px)';

export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isNarrow;
}
