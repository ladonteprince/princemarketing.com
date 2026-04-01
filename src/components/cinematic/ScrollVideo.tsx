'use client';
import { useRef, useEffect } from 'react';

export function ScrollVideo({ src, poster }: { src: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    video.preload = 'auto';
    video.load();

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const scrollProgress = Math.max(
          0,
          Math.min(1, -rect.top / (rect.height - window.innerHeight))
        );
        if (video.duration) {
          video.currentTime = scrollProgress * video.duration;
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
      {/* Video — hidden on mobile, visible on md+ */}
      <video
        ref={videoRef}
        poster={poster}
        muted
        playsInline
        className="hidden h-full w-full object-cover opacity-30 lg:block"
      >
        <source src={src} type="video/mp4" />
      </video>
      {/* Static fallback for mobile */}
      <div
        className="h-full w-full bg-cover bg-center opacity-30 lg:hidden"
        style={{ backgroundImage: `url(${poster})` }}
      />
    </div>
  );
}
