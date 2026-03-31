'use client';

import { lazy, Suspense } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline/next'));

export function SplineBackground() {
  return (
    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
      <Suspense fallback={null}>
        <Spline scene="https://prod.spline.design/nIxHJ3ijYPD4GmOM/scene.splinecode" />
      </Suspense>
    </div>
  );
}
