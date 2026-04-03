"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

function toSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/admin")) {
    return "/admin";
  }
  return value;
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configMissing = searchParams.get("error") === "config_missing";
  const nextPath = useMemo(() => toSafeNextPath(searchParams.get("next")), [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passcode,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(body.error ?? "Login failed.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("Could not reach login endpoint.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Access</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Sign In To Admin</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your admin passcode to access scorekeeping and write operations.
      </p>

      {configMissing && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Admin auth is not configured. Set `ADMIN_OWNER_KEY` (or `ADMIN_ACCESS_KEY`) in `.env.local` and Vercel.
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-800">Admin Passcode</span>
          <input
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting || !passcode.trim()}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {isSubmitting ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        <Link href="/" className="font-semibold text-slate-700 hover:text-slate-900">
          Back to Public Site
        </Link>
      </div>
    </section>
  );
}
