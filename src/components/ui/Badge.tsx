import type { ReactNode } from "react";

type BadgeVariant = "default" | "royal" | "mint" | "amber" | "coral";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-smoke text-ash",
  royal: "bg-royal-muted text-royal",
  mint: "bg-emerald-400/12 text-emerald-400",
  amber: "bg-amber-400/12 text-amber-400",
  coral: "bg-red-400/12 text-red-400",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-md px-2 py-0.5
        text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
