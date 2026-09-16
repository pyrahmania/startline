-- startline365 beta schema. Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  city text not null default '',
  units text not null default 'km' check (units in ('km', 'mi')),
  year int not null default 2026,
  crew_code text,
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
  race_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.overlaps (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  race_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b, race_key),
  check (user_a < user_b)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  actor uuid not null references public.profiles (id) on delete cascade,
  other_user uuid references public.profiles (id) on delete set null,
  race_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_code_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists season_entries_user_idx on public.season_entries (user_id);
create index if not exists custom_races_user_idx on public.custom_races (user_id);
create index if not exists invites_from_idx on public.invites (from_user);
create index if not exists events_kind_idx on public.events (kind, created_at desc);
create unique index if not exists events_overlap_uniq
  on public.events (kind, actor, other_user, race_key)
  where kind = 'overlap_created';
create unique index if not exists profiles_crew_code_uidx
  on public.profiles (crew_code)
  where crew_code is not null;
create index if not exists crew_code_attempts_user_idx
  on public.crew_code_attempts (user_id, attempted_at desc);

create or replace function public.alloc_crew_code()
returns text
language plpgsql
as $$
declare
  b bytea;
  n int;
  candidate text;
  i int;
begin
  for i in 1..40 loop
    b := gen_random_bytes(4);
    n := 100000 + (
      (
        get_byte(b, 0)::bigint * 16777216
        + get_byte(b, 1)::bigint * 65536
        + get_byte(b, 2)::bigint * 256
        + get_byte(b, 3)::bigint
      ) % 900000
    )::int;
    candidate := n::text;
    if not exists (select 1 from public.profiles where crew_code = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'could not allocate crew code';
end;
$$;

revoke all on function public.alloc_crew_code() from public, anon, authenticated;

create or replace function public.freeze_crew_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.crew_code is distinct from old.crew_code then
    if current_setting('app.allow_crew_code', true) is distinct from '1' then
      new.crew_code := old.crew_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_freeze_crew_code on public.profiles;
create trigger profiles_freeze_crew_code
  before update on public.profiles
  for each row execute procedure public.freeze_crew_code();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
begin
  for i in 1..20 loop
    begin
      insert into public.profiles (id, crew_code)
      values (new.id, public.alloc_crew_code())
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      null;
    end;
  end loop;
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

create or replace function public.capture_overlap(u1 uuid, u2 uuid, rkey text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
  n int;
begin
  if u1 is null or u2 is null or u1 = u2 or rkey is null or length(rkey) = 0 then
    return;
  end if;
  if u1 < u2 then a := u1; b := u2; else a := u2; b := u1; end if;
  insert into public.overlaps (user_a, user_b, race_key)
  values (a, b, rkey)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.events (kind, actor, other_user, race_key)
    values ('overlap_created', a, b, rkey)
    on conflict do nothing;
  end if;
end;
$$;

drop function if exists public.create_invite();
create or replace function public.create_invite(race_key text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  open_count int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select count(*) into open_count
  from public.invites
  where from_user = auth.uid()
    and used_at is null
    and expires_at > now();
  if open_count >= 5 then
    raise exception 'invite limit reached';
  end if;
  new_code := encode(gen_random_bytes(6), 'hex');
  insert into public.invites (code, from_user, expires_at, race_key)
  values (new_code, auth.uid(), now() + interval '14 days', race_key);
  insert into public.events (kind, actor, race_key)
  values ('invite_sent', auth.uid(), race_key);
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
  insert into public.events (kind, actor, other_user, race_key)
  values ('invite_accepted', auth.uid(), inv.from_user, inv.race_key);
end;
$$;

create or replace function public.scan_overlaps_for_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  for other in
    select case when c.user_a = new.user_id then c.user_b else c.user_a end
    from public.crew_links c
    where c.user_a = new.user_id or c.user_b = new.user_id
  loop
    if exists (
      select 1 from public.season_entries s
      where s.user_id = other and s.key = new.key
    ) then
      perform public.capture_overlap(new.user_id, other, new.key);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists season_overlap_aiu on public.season_entries;
create trigger season_overlap_aiu
  after insert or update of key on public.season_entries
  for each row execute procedure public.scan_overlaps_for_entry();

create or replace function public.scan_overlaps_for_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rkey text;
begin
  for rkey in
    select a.key
    from public.season_entries a
    join public.season_entries b on a.key = b.key
    where a.user_id = new.user_a and b.user_id = new.user_b
  loop
    perform public.capture_overlap(new.user_a, new.user_b, rkey);
  end loop;
  return new;
end;
$$;

drop trigger if exists crew_overlap_ai on public.crew_links;
create trigger crew_overlap_ai
  after insert on public.crew_links
  for each row execute procedure public.scan_overlaps_for_link();

alter table public.profiles enable row level security;
alter table public.custom_races enable row level security;
alter table public.season_entries enable row level security;
alter table public.crew_links enable row level security;
alter table public.invites enable row level security;
alter table public.overlaps enable row level security;
alter table public.events enable row level security;
alter table public.crew_code_attempts enable row level security;

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

drop policy if exists "overlaps read self" on public.overlaps;
create policy "overlaps read self"
  on public.overlaps for select
  using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "events insert self" on public.events;
create policy "events insert self"
  on public.events for insert
  with check (actor = auth.uid());

drop policy if exists "events read self" on public.events;
create policy "events read self"
  on public.events for select
  using (actor = auth.uid() or other_user = auth.uid());

grant select on public.overlaps to authenticated;
grant select, insert on public.events to authenticated;
grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.is_crew(uuid) to authenticated;
grant execute on function public.capture_overlap(uuid, uuid, text) to authenticated;

create or replace function public.ensure_crew_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select crew_code into existing from public.profiles where id = auth.uid();
  if existing is not null then
    return existing;
  end if;
  for i in 1..20 loop
    begin
      perform set_config('app.allow_crew_code', '1', true);
      insert into public.profiles (id, crew_code)
      values (auth.uid(), public.alloc_crew_code())
      on conflict (id) do nothing;
      select crew_code into existing from public.profiles where id = auth.uid();
      if existing is not null then
        return existing;
      end if;
      perform set_config('app.allow_crew_code', '1', true);
      update public.profiles
         set crew_code = public.alloc_crew_code()
       where id = auth.uid()
         and crew_code is null;
      select crew_code into existing from public.profiles where id = auth.uid();
      if existing is not null then
        return existing;
      end if;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'could not allocate crew code';
end;
$$;

create or replace function public.regenerate_crew_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code text;
  i int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  perform public.ensure_crew_code();
  for i in 1..20 loop
    begin
      next_code := public.alloc_crew_code();
      perform set_config('app.allow_crew_code', '1', true);
      update public.profiles
         set crew_code = next_code
       where id = auth.uid();
      return next_code;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'could not allocate crew code';
end;
$$;

create or replace function public.accept_crew_code(raw_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text;
  owner uuid;
  recent int;
  a uuid;
  b uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  digits := regexp_replace(coalesce(raw_code, ''), '\D', '', 'g');
  if digits !~ '^\d{6}$' then
    raise exception 'invalid code';
  end if;

  select count(*) into recent
  from public.crew_code_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '10 minutes';
  if recent >= 10 then
    raise exception 'too many attempts';
  end if;

  select id into owner from public.profiles where crew_code = digits;
  if owner is null then
    insert into public.crew_code_attempts (user_id) values (auth.uid());
    raise exception 'code not found';
  end if;
  if owner = auth.uid() then
    raise exception 'cannot add yourself';
  end if;

  if owner < auth.uid() then
    a := owner;
    b := auth.uid();
  else
    a := auth.uid();
    b := owner;
  end if;
  insert into public.crew_links (user_a, user_b)
  values (a, b)
  on conflict do nothing;
  get diagnostics recent = row_count;
  if recent > 0 then
    insert into public.events (kind, actor, other_user)
    values ('invite_accepted', auth.uid(), owner);
  end if;
end;
$$;

grant execute on function public.ensure_crew_code() to authenticated;
grant execute on function public.regenerate_crew_code() to authenticated;
grant execute on function public.accept_crew_code(text) to authenticated;

create or replace function public.norm_person_name(raw text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(raw, '')), '\s+', ' ', 'g'));
$$;

revoke all on function public.norm_person_name(text) from public, anon, authenticated;

create or replace function public.match_crew_name(raw_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  needle text;
  recent int;
  n int;
  owner uuid;
  display_name text;
  display_city text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  needle := public.norm_person_name(raw_name);
  if needle is null or length(needle) < 2 or needle ~ '^\d{6}$' then
    raise exception 'invalid name';
  end if;

  select count(*) into recent
  from public.crew_code_attempts
  where user_id = auth.uid()
    and attempted_at > now() - interval '10 minutes';
  if recent >= 10 then
    raise exception 'too many attempts';
  end if;

  select count(*) into n
  from public.profiles p
  where public.norm_person_name(p.name) = needle
    and p.id <> auth.uid()
    and length(public.norm_person_name(p.name)) >= 2;

  if n = 0 then
    if exists (
      select 1 from public.profiles
      where id = auth.uid()
        and public.norm_person_name(name) = needle
    ) then
      raise exception 'cannot add yourself';
    end if;
    insert into public.crew_code_attempts (user_id) values (auth.uid());
    raise exception 'name not found';
  end if;
  if n > 1 then
    insert into public.crew_code_attempts (user_id) values (auth.uid());
    raise exception 'name not unique';
  end if;

  select p.id, p.name, coalesce(p.city, '')
    into owner, display_name, display_city
  from public.profiles p
  where public.norm_person_name(p.name) = needle
    and p.id <> auth.uid()
  limit 1;

  return json_build_object(
    'id', owner,
    'name', display_name,
    'city', display_city
  );
end;
$$;

create or replace function public.accept_crew_person(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
  n int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if target is null then
    raise exception 'invalid name';
  end if;
  if target = auth.uid() then
    raise exception 'cannot add yourself';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'name not found';
  end if;

  if target < auth.uid() then
    a := target;
    b := auth.uid();
  else
    a := auth.uid();
    b := target;
  end if;
  insert into public.crew_links (user_a, user_b)
  values (a, b)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    begin
      insert into public.events (kind, actor, other_user)
      values ('invite_accepted', auth.uid(), target);
    exception when undefined_table then
      null;
    end;
  end if;
end;
$$;

grant execute on function public.match_crew_name(text) to authenticated;
grant execute on function public.accept_crew_person(uuid) to authenticated;
