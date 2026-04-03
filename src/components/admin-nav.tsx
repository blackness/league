"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavLink {
  href: string;
  label: string;
  matchPrefix?: boolean;
}

interface AdminNavSection {
  title: string;
  links: AdminNavLink[];
}

const adminNavSections: AdminNavSection[] = [
  {
    title: "Control Center",
    links: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/scorekeeper", label: "Scorekeeper Hub" },
      { href: "/admin/games/new", label: "Create Game" },
      { href: "/admin/schedule-builder", label: "Schedule Builder" },
    ],
  },
  {
    title: "Data And Setup",
    links: [
      { href: "/admin/teams", label: "Teams" },
      { href: "/admin/import", label: "Imports And Backfill" },
    ],
  },
];

function isActive(pathname: string, link: AdminNavLink): boolean {
  if (link.matchPrefix) {
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }
  return pathname === link.href;
}

function toRouteLabel(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminNav() {
  const pathname = usePathname();
  const gameRouteMatch = pathname.match(/^\/admin\/games\/([^/]+)\/(scorekeeper|scoresheet|stats)$/);
  const gameId = gameRouteMatch?.[1] ?? null;
  const gamePageType = gameRouteMatch?.[2] ?? null;

  const breadcrumbParts = pathname
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map((segment) => segment);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {adminNavSections.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.title}</p>
            <nav className="mt-2 flex flex-wrap gap-2">
              {section.links.map((link) => {
                const active = isActive(pathname, link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </section>
        ))}
      </div>

      {gameId && (
        <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Current Game Tools</p>
          <nav className="mt-2 flex flex-wrap gap-2 text-sm">
            {[
              { href: `/admin/games/${gameId}/scorekeeper`, label: "Full Scorekeeper" },
              { href: `/admin/games/${gameId}/scoresheet`, label: "Slim Scoresheet" },
              { href: `/admin/games/${gameId}/stats`, label: "Game Stats Editor" },
              { href: `/games/${gameId}/live`, label: "Public Live Page" },
              { href: `/games/${gameId}/stats`, label: "Public Boxscore" },
            ].map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 font-semibold ${
                    active
                      ? "bg-cyan-700 text-white"
                      : "bg-white text-cyan-800 hover:bg-cyan-100"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {gamePageType && (
            <p className="mt-2 text-xs text-cyan-800">
              Active panel: <span className="font-semibold">{toRouteLabel(gamePageType)}</span>
            </p>
          )}
        </section>
      )}

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Path: <span className="font-mono text-slate-700">/admin{breadcrumbParts.length > 0 ? `/${breadcrumbParts.join("/")}` : ""}</span>
      </div>
    </div>
  );
}
