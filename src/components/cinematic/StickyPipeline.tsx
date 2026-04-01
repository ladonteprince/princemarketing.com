'use client';
import Image from 'next/image';
import { useRef, useEffect, useState } from 'react';

const PIPELINE_STEPS = [
  {
    number: '01',
    title: 'Create',
    subtitle: 'Content that converts',
    description:
      'Your AI content agent assembles scroll-stopping posts, branded visuals, email copy, and video — all tailored to your strategy. Every piece is on-brand and ready to publish.',
    image: '/images/feature-create.png',
    alt: 'AI content creation showing Instagram posts, email templates, and video assembly',
  },
  {
    number: '02',
    title: 'Distribute',
    subtitle: 'Every platform, on autopilot',
    description:
      'One tap deploys your content across Instagram, Facebook, LinkedIn, X, and email. Each post is optimized for the platform it lives on — right format, right time, right audience.',
    image: '/images/feature-distribute.png',
    alt: 'Content distribution across five social media platforms simultaneously',
  },
  {
    number: '03',
    title: 'Measure',
    subtitle: 'Data that drives decisions',
    description:
      'Real-time A/B testing, engagement tracking, and KPI dashboards show you exactly what is working. Your strategy evolves automatically based on performance data.',
    image: '/images/feature-kpi.png',
    alt: 'Analytics dashboard showing A/B testing results and key performance indicators',
  },
] as const;

export function StickyPipeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const stepElements = sectionRef.current?.querySelectorAll('[data-step]');
    if (!stepElements) return;

    stepElements.forEach((el, i) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveStep(i);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pipeline"
      className="border-t border-smoke"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-royal">
          The pipeline
        </p>
        <h2 className="mb-6 text-3xl font-bold text-cloud sm:text-4xl">
          Create. Distribute. Measure. Repeat.
        </h2>
        <p className="mb-20 max-w-2xl text-lg text-ash">
          Your entire marketing pipeline in three acts — each one powered by AI,
          each one building on the last.
        </p>
      </div>

      {/* Sticky stacking sections */}
      {PIPELINE_STEPS.map((step, i) => (
        <div
          key={step.number}
          data-step={i}
          className="lg:sticky border-t border-smoke bg-void"
          style={{ top: `${i * 4}rem` }}
        >
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:items-center md:py-24 lg:gap-16 lg:px-8">
            {/* Text — alternating order on md+ only; on mobile text always comes after image */}
            <div className={`order-2 md:order-none ${i % 2 === 1 ? 'md:order-2' : ''}`}>
              <span className="mb-4 block font-mono text-xs text-ash/40">
                {step.number}
              </span>
              <h3 className="mb-2 text-2xl font-bold text-cloud sm:text-3xl">
                {step.title}
              </h3>
              <p className="mb-4 text-lg font-medium text-royal">
                {step.subtitle}
              </p>
              <p className="max-w-md text-base leading-relaxed text-ash">
                {step.description}
              </p>
            </div>

            {/* Image */}
            <div
              className={`order-1 relative overflow-hidden rounded-xl border border-smoke md:order-none ${
                i % 2 === 1 ? 'md:order-1' : ''
              }`}
            >
              <Image
                src={step.image}
                alt={step.alt}
                width={800}
                height={600}
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
