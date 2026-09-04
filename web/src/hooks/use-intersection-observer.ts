import { RefObject, useEffect, useRef, useState } from 'react';

type Options = IntersectionObserverInit & {
  freezeOnceVisible?: boolean;
};

export function useIntersectionObserver(
  callback?: IntersectionObserverCallback,
  {
    threshold = 0,
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = false,
  }: Options = {},
) {
  const ref = useRef<Element | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  const isFrozen = entry?.isIntersecting && freezeOnceVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node || isFrozen || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        setEntry(entries[0]);
        if (callback) callback(entries, obs);
      },
      { threshold, root, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [callback, threshold, root, rootMargin, isFrozen]);

  return {
    ref,
    entry,
    isIntersecting: !!entry?.isIntersecting,
  };
}
