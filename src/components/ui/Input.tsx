"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className = "", id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-cloud"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            h-10 w-full rounded-lg border bg-graphite px-3 text-sm text-cloud
            placeholder:text-ash/60
            transition-colors duration-[var(--transition-micro)]
            focus:outline-none focus:ring-2 focus:ring-royal focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-coral" : "border-smoke"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-coral">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-ash">{hint}</p>
        )}
      </div>
    );
  },
);
