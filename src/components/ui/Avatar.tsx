import { getInitials } from "@/utils/format";

type AvatarProps = {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeStyles = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-xs",
  lg: "w-11 h-11 text-sm",
} as const;

export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Avatar"}
        className={`
          rounded-full object-cover
          ${sizeStyles[size]}
          ${className}
        `}
      />
    );
  }

  return (
    <div
      className={`
        flex items-center justify-center rounded-full
        bg-royal-muted text-royal font-medium
        ${sizeStyles[size]}
        ${className}
      `}
      aria-label={name ?? "User avatar"}
    >
      {name ? getInitials(name) : "?"}
    </div>
  );
}
