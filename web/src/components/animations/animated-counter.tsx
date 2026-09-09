'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: string;
  label: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  label,
  duration = 2000,
  className = '',
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Parse the value to extract number and suffix
  const parseValue = (val: string) => {
    const match = val.match(/^([\d,]+)(\+|%|\/\d+)?$/);
    if (!match) return { number: 0, suffix: '' };
    
    const number = parseInt(match[1].replace(/,/g, ''), 10);
    const suffix = match[2] || '';
    return { number, suffix };
  };

  const { number: targetNumber, suffix } = parseValue(value);

  // Intersection Observer to trigger animation when element is visible
  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasAnimated) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            const startTime = performance.now();
            const startCount = 0;

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);

              // Easing function for smooth animation (easeOutExpo)
              const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
              
              const currentCount = Math.floor(startCount + (targetNumber - startCount) * easeOutExpo);
              setCount(currentCount);

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
          }
        });
      },
      {
        threshold: 0.3,
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [hasAnimated, targetNumber, duration]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  return (
    <div
      ref={elementRef}
      className={`text-center transition-transform duration-300 hover:scale-105 ${className}`}
    >
      <div
        className="text-3xl font-bold text-gray-900 md:text-4xl"
        aria-live="polite"
        aria-atomic="true"
      >
        {formatNumber(count)}
        {suffix}
      </div>
      <div className="mt-2 text-sm text-gray-600 md:text-base">{label}</div>
    </div>
  );
}

export function AnimatedCounterGrid({
  stats,
  className = '',
}: {
  stats: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-8 md:grid-cols-4 ${className}`}>
      {stats.map((stat, index) => (
        <AnimatedCounter key={index} value={stat.value} label={stat.label} />
      ))}
    </div>
  );
}
