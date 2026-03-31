// Skeleton loading component
// WHY: Brand spec requires skeleton screens, never spinners

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
};

const roundedStyles = {
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${roundedStyles[rounded]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// Pre-composed skeleton patterns for common UI elements
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-smoke bg-graphite p-5">
      <Skeleton height={16} width="40%" className="mb-3" />
      <SkeletonText lines={2} />
      <div className="mt-4 flex gap-2">
        <Skeleton height={32} width={80} rounded="lg" />
        <Skeleton height={32} width={80} rounded="lg" />
      </div>
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="rounded-xl border border-smoke bg-graphite p-5">
      <Skeleton height={12} width="50%" className="mb-2" />
      <Skeleton height={28} width="30%" className="mb-1" />
      <Skeleton height={10} width="40%" />
    </div>
  );
}
