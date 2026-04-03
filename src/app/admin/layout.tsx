import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Workspace</p>
            <p className="text-sm text-slate-600">
              Operations tools are isolated from the public site and organized by workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin/scorekeeper"
              className="rounded-md bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700"
            >
              Open Scorekeeper Hub
            </Link>
            <Link
              href="/admin/games/new"
              className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:text-slate-900"
            >
              Create Game
            </Link>
            <Link
              href="/"
              className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:text-slate-900"
            >
              Back To Public Site
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <AdminNav />
        </div>
      </section>
      {children}
    </div>
  );
}
