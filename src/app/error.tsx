"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void text-cloud px-4">
      <h1 className="text-4xl font-bold text-royal mb-4">
        Something went wrong
      </h1>
      <p className="text-ash mb-8 max-w-md text-center">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90 cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
