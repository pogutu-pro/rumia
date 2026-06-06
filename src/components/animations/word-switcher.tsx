'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface WordSwitcherProps {
  words: string[];
  interval?: number;
  className?: string;
}

export function WordSwitcher({
  words,
  interval = 3500,
  className = '',
}: WordSwitcherProps) {
  const [index, setIndex] = React.useState(0);
  const shouldReduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (shouldReduceMotion) return;

    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval, shouldReduceMotion]);

  // If reduced motion is preferred, just show the first word static or handle accordingly
  // For simplicity and accessibility, we'll just show the first word without cycling
  if (shouldReduceMotion) {
    return <span className={className}>{words[0]}</span>;
  }

  return (
    <span className={`relative inline-block ${className}`} style={{ willChange: 'transform, opacity' }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ 
            duration: 0.4, 
            ease: [0.23, 1, 0.32, 1] // Custom ease-out quint for smoother feel
          }}
          className="inline-block"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
