"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { RegisterInput } from "@/types/user";

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterInput>({
    email: "",
    password: "",
    name: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof RegisterInput, string>>
  >({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  function updateField(field: keyof RegisterInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    // 1. Validate
    const newErrors: Partial<Record<keyof RegisterInput, string>> = {};
    if (!form.name) newErrors.name = "Name is required";
    if (!form.email) newErrors.email = "Email is required";
    if (!form.password || form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 2. Submit
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setServerError(
          (body as { error?: string }).error ?? "Registration failed",
        );
        return;
      }

      // 3. Redirect to dashboard for onboarding
      window.location.href = "/chat";
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
          Create your account
        </h1>
        <p className="mb-8 text-center text-sm text-ash">
          5 minutes to your first marketing strategy
        </p>

        {serverError && (
          <div className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Your name"
            type="text"
            placeholder="Marcus Johnson"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            error={errors.name}
            autoComplete="name"
          />

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
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            error={errors.password}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ash">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-royal transition-colors hover:text-royal-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
