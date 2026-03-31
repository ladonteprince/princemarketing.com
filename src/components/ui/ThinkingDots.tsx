// Royal dot pulse — the signature AI thinking indicator
// WHY: The ONLY alive animation in the entire product

export function ThinkingDots() {
  return (
    <div className="thinking-dots flex items-center gap-1.5 py-1" role="status" aria-label="AI is thinking">
      <span className="royal-dot royal-dot-animate" />
      <span className="royal-dot royal-dot-animate" />
      <span className="royal-dot royal-dot-animate" />
    </div>
  );
}
