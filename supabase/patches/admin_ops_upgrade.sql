-- Admin operations upgrade: audit logging + schedule change history.

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor text not null,
  role text,
  target_table text,
  target_id text,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on admin_audit_log(created_at desc);
create index if not exists idx_admin_audit_log_action on admin_audit_log(action);

create table if not exists schedule_change_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  changed_by text not null,
  reason text not null,
  previous_values jsonb not null default '{}'::jsonb,
  next_values jsonb not null default '{}'::jsonb,
  conflict_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_schedule_change_history_game_id
  on schedule_change_history(game_id);

create index if not exists idx_schedule_change_history_created_at
  on schedule_change_history(created_at desc);

alter table admin_audit_log enable row level security;
alter table schedule_change_history enable row level security;

drop policy if exists "Authenticated can read admin audit log" on admin_audit_log;
create policy "Authenticated can read admin audit log"
on admin_audit_log for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated can read schedule change history" on schedule_change_history;
create policy "Authenticated can read schedule change history"
on schedule_change_history for select
using (auth.role() = 'authenticated');
