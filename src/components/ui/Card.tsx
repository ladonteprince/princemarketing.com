import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
} as const;

export function Card({
  children,
  padding = "md",
  hover = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl border border-smoke bg-graphite
        ${paddingStyles[padding]}
        ${hover ? "transition-colors duration-[var(--transition-micro)] hover:border-ash/30 hover:bg-slate" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
