import { getPublicTeamOptions, getTeamComparisonDetails } from "@/lib/portal-data";

interface ComparePageProps {
  searchParams: Promise<{
    teamA?: string;
    teamB?: string;
  }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const teamOptions = await getPublicTeamOptions();

  const defaultTeamA = params.teamA ?? teamOptions[0]?.teamId ?? "";
  const defaultTeamB = params.teamB ?? teamOptions[1]?.teamId ?? "";

  const comparison =
    defaultTeamA && defaultTeamB && defaultTeamA !== defaultTeamB
      ? await getTeamComparisonDetails(defaultTeamA, defaultTeamB)
      : null;

  return (
    <main className="w-full space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Public Comparison</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Team vs Team Stats</h1>
        <p className="mt-2 text-sm text-slate-600">
          Compare two teams by record, scoring, head-to-head, and aggregate stat metrics.
        </p>

        <form className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Team A</span>
            <select
              name="teamA"
              defaultValue={defaultTeamA}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {teamOptions.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName} - {team.leagueName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-800">Team B</span>
            <select
              name="teamB"
              defaultValue={defaultTeamB}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {teamOptions.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName} - {team.leagueName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Compare Teams
            </button>
          </div>
        </form>
      </section>

      {!comparison && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Select two different teams to run a comparison.
          </p>
        </section>
      )}

      {comparison && (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{comparison.teamA.teamName}</h2>
              <p className="text-sm text-slate-600">{comparison.teamA.leagueName}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>Games: {comparison.teamA.gamesPlayed}</li>
                <li>
                  Record: {comparison.teamA.wins}-{comparison.teamA.losses}-{comparison.teamA.ties}
                </li>
                <li>
                  Points: {comparison.teamA.pointsFor} for / {comparison.teamA.pointsAgainst} against
                </li>
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{comparison.teamB.teamName}</h2>
              <p className="text-sm text-slate-600">{comparison.teamB.leagueName}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>Games: {comparison.teamB.gamesPlayed}</li>
                <li>
                  Record: {comparison.teamB.wins}-{comparison.teamB.losses}-{comparison.teamB.ties}
                </li>
                <li>
                  Points: {comparison.teamB.pointsFor} for / {comparison.teamB.pointsAgainst} against
                </li>
              </ul>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Head-to-Head</h3>
            <p className="mt-2 text-sm text-slate-700">
              {comparison.teamA.teamName}: {comparison.headToHead.teamAWins} wins
            </p>
            <p className="text-sm text-slate-700">
              {comparison.teamB.teamName}: {comparison.headToHead.teamBWins} wins
            </p>
            <p className="text-sm text-slate-700">Ties: {comparison.headToHead.ties}</p>
            <p className="text-sm text-slate-700">
              Total points: {comparison.headToHead.totalPointsA} - {comparison.headToHead.totalPointsB}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Metric Comparison</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Metric</th>
                    <th className="px-2 py-2">{comparison.teamA.teamName}</th>
                    <th className="px-2 py-2">{comparison.teamB.teamName}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.comparisonMetrics.map((metric) => (
                    <tr key={metric.key} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-slate-700">{metric.label}</td>
                      <td className="px-2 py-2 font-semibold text-slate-900">{metric.teamAValue}</td>
                      <td className="px-2 py-2 font-semibold text-slate-900">{metric.teamBValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-slate-600">{comparison.statusMessage}</p>
          </section>
        </>
      )}
    </main>
  );
}
