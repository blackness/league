import Link from "next/link";
import { getAdminDashboardData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Admin Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Leagues, Tournaments, and Live Operations
        </h1>
        <p className="mt-2 text-sm text-slate-600">{data.statusMessage}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/admin/games/new"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Create</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Ad-hoc Game</p>
          <p className="mt-1 text-sm text-slate-600">Quick setup with sport templates and optional rosters.</p>
        </Link>

        <Link
          href="/admin/scorekeeper"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Operate</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Scorekeeper Hub</p>
          <p className="mt-1 text-sm text-slate-600">Open any game, run clock, score events, and track stats.</p>
        </Link>

        <Link
          href="/admin/schedule-builder"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">League Schedules</p>
          <p className="mt-1 text-sm text-slate-600">Generate and publish round-robin schedules.</p>
        </Link>

        <Link
          href="/admin/teams"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Teams</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">Manage Teams</p>
          <p className="mt-1 text-sm text-slate-600">Create teams manually or import in bulk from CSV.</p>
        </Link>

        <Link
          href="/admin/import"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Data</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">CSV Imports</p>
          <p className="mt-1 text-sm text-slate-600">Dry run rosters and validate references before write.</p>
        </Link>
      </section>
    </main>
  );
}
