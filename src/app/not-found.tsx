import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void text-cloud px-4">
      <h1 className="text-6xl font-bold text-royal mb-4">404</h1>
      <p className="text-xl text-ash mb-8">
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90"
      >
        Go home
      </Link>
    </div>
  );
}
