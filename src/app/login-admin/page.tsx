import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin-login-form";

function LoginFallback() {
  return (
    <section className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">Loading admin login...</p>
    </section>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="w-full space-y-6">
      <Suspense fallback={<LoginFallback />}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}

