create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid null,
  title text not null,
  description text null,
  deadline timestamptz null,
  category text not null default 'personal',
  status text not null default 'active',
  impact int not null default 3 check (impact between 1 and 5),
  event_importance int null check (event_importance between 1 and 5),
  sunk_cost_minutes int null,
  opportunity_name text null,
  submission_url text null,
  requirements text null,
  effort_minutes int null,
  energy_required text not null default 'medium',
  context text null,
  next_action text null,
  snoozed_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid null,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  channel_type text not null,
  label text not null,
  target text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  interaction_type text not null,
  input text not null,
  output jsonb not null default '{}',
  provider text not null default 'groq',
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid null,
  remind_at timestamptz not null,
  reminder_type text not null default 'custom',
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid references public.reminders(id) on delete cascade,
  channel_id uuid references public.notification_channels(id) on delete set null,
  user_id uuid null,
  status text not null,
  error text null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists reminders_due_idx on public.reminders(remind_at, status);
create index if not exists ai_interactions_created_idx on public.ai_interactions(created_at);
create index if not exists notification_deliveries_reminder_idx on public.notification_deliveries(reminder_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.notification_channels enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own task events" on public.task_events;
create policy "Users can manage own task events" on public.task_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own notification channels" on public.notification_channels;
create policy "Users can manage own notification channels" on public.notification_channels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own AI interactions" on public.ai_interactions;
create policy "Users can manage own AI interactions" on public.ai_interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own reminders" on public.reminders;
create policy "Users can manage own reminders" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own notification deliveries" on public.notification_deliveries;
create policy "Users can read own notification deliveries" on public.notification_deliveries
  for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
