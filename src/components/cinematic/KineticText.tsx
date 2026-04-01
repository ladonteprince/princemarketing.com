'use client';
import { useState, useEffect, useCallback } from 'react';

const WORDS = ['strategy', 'content', 'scheduling', 'analytics', 'growth'];

export function KineticText() {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const cycle = useCallback(() => {
    setIsVisible(false);
    const timeout = setTimeout(() => {
      setIndex((i) => (i + 1) % WORDS.length);
      setIsVisible(true);
    }, 300);
    return timeout;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      cycle();
    }, 2500);
    return () => clearInterval(interval);
  }, [cycle]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0'
      }`}
    >
      {WORDS[index]}
    </span>
  );
}
