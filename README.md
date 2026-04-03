# Sports League Portal Starter

Sport-agnostic league foundation for hockey, basketball, volleyball, ultimate frisbee, tennis, and more.

Stack:
- Next.js 16 + TypeScript
- Supabase (Postgres + Realtime + Auth-ready)
- Vercel/GitHub deployment flow

## Included in This Starter

- Multi-league dashboard with live and upcoming games
- League standings page
- Public live game page with realtime event feed
- Per-game stats page with player lines and team comparisons
- Public team pages with stream embeds and links
- Schedule builder with round-robin constraints + CSV export
- CSV roster dry run with validation API
- Public team-vs-team comparison page
- Professional scorekeeper console with clock, quick actions, event timeline, and scorepad
- Player stat pad in scorekeeper (`select player -> click stat +1/-1`)
- Ad-hoc game setup wizard (sport -> teams -> optional players -> tracked stats -> start game)
- Admin operations hub for scorekeeper/game management
- Supabase schema (`supabase/schema.sql`) with:
  - leagues, seasons, teams, players, rosters
  - games + game events
  - game team stats + player game stats
  - standings view derived from final games

## Key Routes

- `/` Dashboard
- `/leagues/:leagueId` Standings and recent games
- `/teams/:teamId` Team page + stream block
- `/games/:gameId/live` Public live page
- `/games/:gameId/stats` Game-level player stats and team comparison
- `/compare` Public team-vs-team stats comparison
- `/admin` Admin dashboard
- `/admin/scorekeeper` Scorekeeper operations hub
- `/admin/games/new` Ad-hoc/league/tournament game setup wizard
- `/admin/schedule-builder` Round-robin schedule generator
- `/api/admin/schedule/publish` Publish generated schedule into `games`
- `/api/admin/schedule/list` List season games for ad-hoc schedule edits
- `/api/admin/schedule/change` Apply ad-hoc schedule changes with conflict checks
- `/admin/import` CSV roster dry run
- `/admin/games/:gameId/scorekeeper` Live scorekeeper console
- `/api/admin/games/:gameId/scorekeeper` Scoreboard/clock/event/scorepad actions
- `/api/admin/games/create` Create ad-hoc/league/tournament-context game
- `/admin/games/:gameId/stats` Team/player game stats editor
- `/api/admin/games/:gameId/stats` Upsert/delete team/player stat rows

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # required for server-side admin write routes
ADMIN_ACCESS_KEY=... # legacy owner-level passcode
ADMIN_OWNER_KEY=... # owner role (full access)
ADMIN_ADMIN_KEY=... # admin role
ADMIN_SCOREKEEPER_KEY=... # scorekeeper role
ADMIN_VIEWER_KEY=... # read-only admin role
```

4. In Supabase Dashboard, open SQL Editor and run:

```sql
-- Paste supabase/schema.sql and execute
```

Then run the admin ops patch:

```sql
-- Paste supabase/patches/admin_ops_upgrade.sql and execute
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sample roster CSV for quick import testing:

```text
public/samples/sample_teams_players.csv
```

## Free Tier Workflow

- Reuse one existing Supabase project or pause one old project before creating a new one.
- Keep Vercel on Hobby while testing/non-commercial.
- Use YouTube/Hudl embeds instead of hosting video files.

## Admin Access Guard

- `/admin/*` and `/api/admin/*` are protected by middleware.
- Open `/login-admin` and sign in with one of your configured role passcodes.
- Role hierarchy: `viewer` < `scorekeeper` < `admin` < `owner`.
- If only `ADMIN_ACCESS_KEY` is set, it behaves as `owner`.

## Suggested Next Milestones

1. Add commit mode for roster import (`dry run` -> `write` path).
2. Add role-aware auth and route protection for admin tools.
3. Add publish history/audit log for scorekeeper and stats actions.
4. Add team and league custom domain mapping.
