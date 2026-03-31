"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { LoginInput } from "@/types/user";

export default function LoginPage() {
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  function updateField(field: keyof LoginInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    // 1. Client-side validation
    const newErrors: Partial<Record<keyof LoginInput, string>> = {};
    if (!form.email) newErrors.email = "Email is required";
    if (!form.password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 2. Submit
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setServerError((body as { error?: string }).error ?? "Login failed");
        return;
      }

      // 3. Redirect to dashboard
      window.location.href = "/";
    } catch {
      setServerError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <img
              src="/logos/pm-icon.svg"
              alt="PrinceMarketing"
              className="h-12 w-12"
            />
          </Link>
        </div>

        <h1 className="mb-1 text-center text-2xl font-bold text-cloud">
          Welcome back
        </h1>
        <p className="mb-8 text-center text-sm text-ash">
          Sign in to your marketing dashboard
        </p>

        {serverError && (
          <div className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@business.com"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            error={errors.email}
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ash">
          No account yet?{" "}
          <Link
            href="/register"
            className="font-medium text-royal transition-colors hover:text-royal-hover"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
