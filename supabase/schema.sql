create extension if not exists pgcrypto;

do $$
begin
  create type game_status as enum ('scheduled', 'live', 'final', 'postponed', 'canceled');
exception
  when duplicate_object then null;
end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sports (
  id text primary key,
  name text not null,
  scoring_model text not null
);

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sport_id text not null references sports(id),
  name text not null,
  slug text not null unique,
  is_public boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  year integer,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  slug text not null,
  city text,
  website_url text,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, slug)
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  jersey_number text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_rosters (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (season_id, team_id, player_id)
);

create table if not exists game_team_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, team_id)
);

create table if not exists player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  starter boolean not null default false,
  minutes_played numeric(5,2),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  sport_id text not null references sports(id),
  scheduled_at timestamptz not null,
  status game_status not null default 'scheduled',
  venue_name text,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score integer not null default 0 check (home_score >= 0),
  away_score integer not null default 0 check (away_score >= 0),
  period_label text,
  stream_provider text,
  stream_url text,
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  event_index integer not null,
  event_type text not null,
  points_home integer not null default 0,
  points_away integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  actor_name text,
  created_at timestamptz not null default now(),
  unique (game_id, event_index)
);

create index if not exists idx_seasons_league_id on seasons(league_id);
create index if not exists idx_teams_league_id on teams(league_id);
create index if not exists idx_games_league_id on games(league_id);
create index if not exists idx_games_season_id on games(season_id);
create index if not exists idx_games_status on games(status);
create index if not exists idx_games_scheduled_at on games(scheduled_at);
create index if not exists idx_game_events_game_id on game_events(game_id);
create index if not exists idx_game_events_created_at on game_events(created_at);
create index if not exists idx_game_team_stats_game_id on game_team_stats(game_id);
create index if not exists idx_game_team_stats_team_id on game_team_stats(team_id);
create index if not exists idx_player_game_stats_game_id on player_game_stats(game_id);
create index if not exists idx_player_game_stats_team_id on player_game_stats(team_id);
create index if not exists idx_player_game_stats_player_id on player_game_stats(player_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at
before update on organizations
for each row execute function set_updated_at();

drop trigger if exists trg_leagues_updated_at on leagues;
create trigger trg_leagues_updated_at
before update on leagues
for each row execute function set_updated_at();

drop trigger if exists trg_seasons_updated_at on seasons;
create trigger trg_seasons_updated_at
before update on seasons
for each row execute function set_updated_at();

drop trigger if exists trg_teams_updated_at on teams;
create trigger trg_teams_updated_at
before update on teams
for each row execute function set_updated_at();

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at
before update on players
for each row execute function set_updated_at();

drop trigger if exists trg_game_team_stats_updated_at on game_team_stats;
create trigger trg_game_team_stats_updated_at
before update on game_team_stats
for each row execute function set_updated_at();

drop trigger if exists trg_player_game_stats_updated_at on player_game_stats;
create trigger trg_player_game_stats_updated_at
before update on player_game_stats
for each row execute function set_updated_at();

drop trigger if exists trg_games_updated_at on games;
create trigger trg_games_updated_at
before update on games
for each row execute function set_updated_at();

alter table organizations enable row level security;
alter table sports enable row level security;
alter table leagues enable row level security;
alter table seasons enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table team_rosters enable row level security;
alter table game_team_stats enable row level security;
alter table player_game_stats enable row level security;
alter table games enable row level security;
alter table game_events enable row level security;

drop policy if exists "Public can read sports" on sports;
create policy "Public can read sports"
on sports for select
using (true);

drop policy if exists "Public can read public leagues" on leagues;
create policy "Public can read public leagues"
on leagues for select
using (is_public = true);

drop policy if exists "Public can read seasons in public leagues" on seasons;
create policy "Public can read seasons in public leagues"
on seasons for select
using (
  exists (
    select 1
    from leagues
    where leagues.id = seasons.league_id
      and leagues.is_public = true
  )
);

drop policy if exists "Public can read teams in public leagues" on teams;
create policy "Public can read teams in public leagues"
on teams for select
using (
  exists (
    select 1
    from leagues
    where leagues.id = teams.league_id
      and leagues.is_public = true
  )
);

drop policy if exists "Public can read public games" on games;
create policy "Public can read public games"
on games for select
using (is_public = true);

drop policy if exists "Public can read events for public games" on game_events;
create policy "Public can read events for public games"
on game_events for select
using (
  exists (
    select 1
    from games
    where games.id = game_events.game_id
      and games.is_public = true
  )
);

drop policy if exists "Public can read team stats for public games" on game_team_stats;
create policy "Public can read team stats for public games"
on game_team_stats for select
using (
  exists (
    select 1
    from games
    where games.id = game_team_stats.game_id
      and games.is_public = true
  )
);

drop policy if exists "Public can read player stats for public games" on player_game_stats;
create policy "Public can read player stats for public games"
on player_game_stats for select
using (
  exists (
    select 1
    from games
    where games.id = player_game_stats.game_id
      and games.is_public = true
  )
);

drop policy if exists "Authenticated can manage leagues" on leagues;
create policy "Authenticated can manage leagues"
on leagues for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage seasons" on seasons;
create policy "Authenticated can manage seasons"
on seasons for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage teams" on teams;
create policy "Authenticated can manage teams"
on teams for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage players" on players;
create policy "Authenticated can manage players"
on players for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage rosters" on team_rosters;
create policy "Authenticated can manage rosters"
on team_rosters for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage games" on games;
create policy "Authenticated can manage games"
on games for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage game events" on game_events;
create policy "Authenticated can manage game events"
on game_events for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage game team stats" on game_team_stats;
create policy "Authenticated can manage game team stats"
on game_team_stats for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage player game stats" on player_game_stats;
create policy "Authenticated can manage player game stats"
on player_game_stats for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace view standings as
with final_rows as (
  select
    g.league_id,
    g.season_id,
    g.home_team_id as team_id,
    case
      when g.home_score > g.away_score then 1
      else 0
    end as wins,
    case
      when g.home_score < g.away_score then 1
      else 0
    end as losses,
    case
      when g.home_score = g.away_score then 1
      else 0
    end as ties,
    g.home_score as points_for,
    g.away_score as points_against
  from games g
  where g.status = 'final'

  union all

  select
    g.league_id,
    g.season_id,
    g.away_team_id as team_id,
    case
      when g.away_score > g.home_score then 1
      else 0
    end as wins,
    case
      when g.away_score < g.home_score then 1
      else 0
    end as losses,
    case
      when g.away_score = g.home_score then 1
      else 0
    end as ties,
    g.away_score as points_for,
    g.home_score as points_against
  from games g
  where g.status = 'final'
)
select
  fr.league_id,
  fr.season_id,
  fr.team_id,
  t.name as team_name,
  sum(fr.wins)::integer as wins,
  sum(fr.losses)::integer as losses,
  sum(fr.ties)::integer as ties,
  sum(fr.points_for)::integer as points_for,
  sum(fr.points_against)::integer as points_against,
  sum(fr.points_for - fr.points_against)::integer as point_diff
from final_rows fr
join teams t on t.id = fr.team_id
group by fr.league_id, fr.season_id, fr.team_id, t.name;

do $$
declare
  v_org_id uuid;
  v_league_id uuid;
  v_season_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_game_id uuid;
  v_home_player_1 uuid;
  v_home_player_2 uuid;
  v_away_player_1 uuid;
  v_away_player_2 uuid;
begin
  insert into sports (id, name, scoring_model)
  values
    ('hockey', 'Hockey', 'goals'),
    ('basketball', 'Basketball', 'points'),
    ('volleyball', 'Volleyball', 'sets'),
    ('ultimate_frisbee', 'Ultimate Frisbee', 'points'),
    ('tennis', 'Tennis', 'sets')
  on conflict (id) do update set
    name = excluded.name,
    scoring_model = excluded.scoring_model;

  insert into organizations (name, slug)
  values ('Demo Sports Org', 'demo-sports-org')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into leagues (organization_id, sport_id, name, slug, is_public)
  values (v_org_id, 'hockey', 'Metro Hockey League', 'metro-hockey-league', true)
  on conflict (slug) do update set
    name = excluded.name,
    sport_id = excluded.sport_id
  returning id into v_league_id;

  insert into seasons (league_id, name, year, is_active, starts_on, ends_on)
  values (v_league_id, '2026 Spring', 2026, true, current_date - 14, current_date + 90)
  on conflict (league_id, name) do update set
    is_active = excluded.is_active
  returning id into v_season_id;

  insert into teams (league_id, name, slug, city, primary_color, secondary_color)
  values
    (v_league_id, 'Harbor Wolves', 'harbor-wolves', 'Harbor City', '#0f172a', '#06b6d4'),
    (v_league_id, 'Northside Blades', 'northside-blades', 'Northside', '#1e293b', '#f97316')
  on conflict (league_id, slug) do update set
    name = excluded.name;

  select t.id into v_home_team_id
  from teams t
  where t.league_id = v_league_id and t.slug = 'harbor-wolves'
  limit 1;

  select t.id into v_away_team_id
  from teams t
  where t.league_id = v_league_id and t.slug = 'northside-blades'
  limit 1;

  select g.id into v_game_id
  from games g
  where g.season_id = v_season_id
    and g.home_team_id = v_home_team_id
    and g.away_team_id = v_away_team_id
  order by g.created_at desc
  limit 1;

  if v_game_id is null then
    insert into games (
      league_id,
      season_id,
      sport_id,
      scheduled_at,
      status,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      period_label,
      stream_provider,
      stream_url,
      is_public
    )
    values (
      v_league_id,
      v_season_id,
      'hockey',
      now() - interval '10 minutes',
      'live',
      v_home_team_id,
      v_away_team_id,
      3,
      2,
      '3rd 07:41',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      true
    )
    returning id into v_game_id;
  end if;

  if v_game_id is not null then
    insert into game_events (game_id, event_index, event_type, points_home, points_away, actor_name, source)
    values
      (v_game_id, 1, 'goal', 1, 0, 'M. Torres', 'manual'),
      (v_game_id, 2, 'goal', 0, 1, 'J. Wong', 'manual'),
      (v_game_id, 3, 'goal', 1, 0, 'A. Brooks', 'manual')
    on conflict (game_id, event_index) do nothing;

    select p.id into v_home_player_1
    from players p
    where p.first_name = 'Maya' and p.last_name = 'Torres' and p.jersey_number = '9'
    limit 1;
    if v_home_player_1 is null then
      insert into players (first_name, last_name, jersey_number, position)
      values ('Maya', 'Torres', '9', 'FWD')
      returning id into v_home_player_1;
    end if;

    select p.id into v_home_player_2
    from players p
    where p.first_name = 'Ari' and p.last_name = 'Brooks' and p.jersey_number = '11'
    limit 1;
    if v_home_player_2 is null then
      insert into players (first_name, last_name, jersey_number, position)
      values ('Ari', 'Brooks', '11', 'C')
      returning id into v_home_player_2;
    end if;

    select p.id into v_away_player_1
    from players p
    where p.first_name = 'Jordan' and p.last_name = 'Wong' and p.jersey_number = '7'
    limit 1;
    if v_away_player_1 is null then
      insert into players (first_name, last_name, jersey_number, position)
      values ('Jordan', 'Wong', '7', 'D')
      returning id into v_away_player_1;
    end if;

    select p.id into v_away_player_2
    from players p
    where p.first_name = 'Noah' and p.last_name = 'Kline' and p.jersey_number = '18'
    limit 1;
    if v_away_player_2 is null then
      insert into players (first_name, last_name, jersey_number, position)
      values ('Noah', 'Kline', '18', 'FWD')
      returning id into v_away_player_2;
    end if;

    insert into team_rosters (season_id, team_id, player_id, role)
    values
      (v_season_id, v_home_team_id, v_home_player_1, 'starter'),
      (v_season_id, v_home_team_id, v_home_player_2, 'starter'),
      (v_season_id, v_away_team_id, v_away_player_1, 'starter'),
      (v_season_id, v_away_team_id, v_away_player_2, 'starter')
    on conflict (season_id, team_id, player_id) do nothing;

    insert into game_team_stats (game_id, team_id, stats)
    values
      (
        v_game_id,
        v_home_team_id,
        '{"shots": 31, "faceoff_win_pct": 54.2, "power_play_goals": 1, "penalty_minutes": 6}'::jsonb
      ),
      (
        v_game_id,
        v_away_team_id,
        '{"shots": 27, "faceoff_win_pct": 45.8, "power_play_goals": 0, "penalty_minutes": 8}'::jsonb
      )
    on conflict (game_id, team_id) do update set
      stats = excluded.stats;

    insert into player_game_stats (game_id, team_id, player_id, starter, minutes_played, stats)
    values
      (
        v_game_id,
        v_home_team_id,
        v_home_player_1,
        true,
        18.5,
        '{"goals": 1, "assists": 1, "shots": 5, "hits": 2}'::jsonb
      ),
      (
        v_game_id,
        v_home_team_id,
        v_home_player_2,
        true,
        17.0,
        '{"goals": 1, "assists": 0, "shots": 4, "hits": 1}'::jsonb
      ),
      (
        v_game_id,
        v_away_team_id,
        v_away_player_1,
        true,
        19.0,
        '{"goals": 1, "assists": 0, "shots": 3, "hits": 3}'::jsonb
      ),
      (
        v_game_id,
        v_away_team_id,
        v_away_player_2,
        true,
        16.5,
        '{"goals": 1, "assists": 0, "shots": 4, "hits": 2}'::jsonb
      )
    on conflict (game_id, player_id) do update set
      team_id = excluded.team_id,
      starter = excluded.starter,
      minutes_played = excluded.minutes_played,
      stats = excluded.stats;
  end if;
end $$;
