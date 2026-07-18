/** Defer heavy computation until a section scrolls near the viewport (perf: keeps boot cheap). */
import { useEffect, useRef, useState } from 'react';

export function useNearViewport<T extends HTMLElement>(rootMargin = '400px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
