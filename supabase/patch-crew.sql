-- Run in the Supabase SQL editor on the existing project.
-- Race-stamped invites, 5 open links, overlap events.

alter table public.invites add column if not exists race_key text;

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

create index if not exists events_kind_idx on public.events (kind, created_at desc);
create unique index if not exists events_overlap_uniq
  on public.events (kind, actor, other_user, race_key)
  where kind = 'overlap_created';

alter table public.overlaps enable row level security;
alter table public.events enable row level security;

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

grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.capture_overlap(uuid, uuid, text) to authenticated;
