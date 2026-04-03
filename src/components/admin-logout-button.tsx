"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  async function onLogout() {
    setIsBusy(true);
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/login-admin");
      router.refresh();
      setIsBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => {
        void onLogout();
      }}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-60"
    >
      {isBusy ? "Signing Out..." : "Sign Out"}
    </button>
  );
}

