// Royal dot pulse — the signature AI thinking indicator
// WHY: The ONLY alive animation in the entire product

export function ThinkingDots() {
  return (
    <div className="thinking-dots flex items-center gap-2 py-1" role="status" aria-label="AI is thinking">
      <span className="royal-dot royal-dot-animate animate-pulse" style={{ animationDelay: "0ms" }} />
      <span className="royal-dot royal-dot-animate animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="royal-dot royal-dot-animate animate-pulse" style={{ animationDelay: "300ms" }} />
    </div>
  );
}
