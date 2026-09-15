-- startline365 beta schema. Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  city text not null default '',
  units text not null default 'km' check (units in ('km', 'mi')),
  year int not null default 2026,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_races (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  date date not null,
  city text not null,
  country text not null default 'GB',
  distance text not null,
  surface text not null default 'road'
);

create table if not exists public.season_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  series_id text not null,
  year int not null,
  status text not null,
  notes text not null default '',
  finish_time text,
  custom_id text,
  unique (user_id, key)
);

create table if not exists public.crew_links (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.invites (
  code text primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists season_entries_user_idx on public.season_entries (user_id);
create index if not exists custom_races_user_idx on public.custom_races (user_id);
create index if not exists invites_from_idx on public.invites (from_user);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_crew(other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select other = auth.uid()
      or exists (
        select 1 from public.crew_links c
        where (c.user_a = auth.uid() and c.user_b = other)
           or (c.user_b = auth.uid() and c.user_a = other)
      );
$$;

create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  new_code := encode(gen_random_bytes(6), 'hex');
  insert into public.invites (code, from_user, expires_at)
  values (new_code, auth.uid(), now() + interval '14 days');
  return new_code;
end;
$$;

create or replace function public.accept_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  a uuid;
  b uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into inv from public.invites where code = invite_code for update;
  if not found then
    raise exception 'invite not found';
  end if;
  if inv.used_at is not null then
    raise exception 'invite already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if inv.from_user = auth.uid() then
    raise exception 'cannot accept your own invite';
  end if;
  if inv.from_user < auth.uid() then
    a := inv.from_user;
    b := auth.uid();
  else
    a := auth.uid();
    b := inv.from_user;
  end if;
  insert into public.crew_links (user_a, user_b)
  values (a, b)
  on conflict do nothing;
  update public.invites
     set used_by = auth.uid(), used_at = now()
   where code = invite_code;
end;
$$;

alter table public.profiles enable row level security;
alter table public.custom_races enable row level security;
alter table public.season_entries enable row level security;
alter table public.crew_links enable row level security;
alter table public.invites enable row level security;

drop policy if exists "profiles read crew" on public.profiles;
create policy "profiles read crew"
  on public.profiles for select
  using (public.is_crew(id));

drop policy if exists "profiles write self" on public.profiles;
create policy "profiles write self"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "season read crew" on public.season_entries;
create policy "season read crew"
  on public.season_entries for select
  using (public.is_crew(user_id));

drop policy if exists "season write self" on public.season_entries;
create policy "season write self"
  on public.season_entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "custom read crew" on public.custom_races;
create policy "custom read crew"
  on public.custom_races for select
  using (public.is_crew(user_id));

drop policy if exists "custom write self" on public.custom_races;
create policy "custom write self"
  on public.custom_races for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crew read self" on public.crew_links;
create policy "crew read self"
  on public.crew_links for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "invites read own" on public.invites;
create policy "invites read own"
  on public.invites for select
  using (from_user = auth.uid());

drop policy if exists "invites insert own" on public.invites;
create policy "invites insert own"
  on public.invites for insert
  with check (from_user = auth.uid());

grant execute on function public.create_invite() to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.is_crew(uuid) to authenticated;
