"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-royal text-white hover:bg-royal-hover active:bg-royal-hover/90",
  secondary:
    "bg-slate text-cloud border border-smoke hover:bg-smoke active:bg-smoke/80",
  ghost:
    "bg-transparent text-ash hover:text-cloud hover:bg-slate active:bg-smoke",
  danger:
    "bg-transparent text-coral border border-coral/30 hover:bg-coral/10 active:bg-coral/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

// WHY: forwardRef so Button composes with form libraries and tooltip triggers
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center rounded-lg font-medium
          transition-all duration-[var(--transition-micro)]
          disabled:opacity-50 disabled:cursor-not-allowed
          cursor-pointer select-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <span className="thinking-dots flex items-center gap-1">
            <span className="royal-dot royal-dot-animate" />
            <span className="royal-dot royal-dot-animate" />
            <span className="royal-dot royal-dot-animate" />
          </span>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  },
);
