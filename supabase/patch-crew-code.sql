-- Run in the Supabase SQL editor on the existing project.
-- Standing 6-digit crew code. Reusable until regenerated. 10 failed guesses / 10 min.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists crew_code text;

create unique index if not exists profiles_crew_code_uidx
  on public.profiles (crew_code)
  where crew_code is not null;

create table if not exists public.crew_code_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists crew_code_attempts_user_idx
  on public.crew_code_attempts (user_id, attempted_at desc);

alter table public.crew_code_attempts enable row level security;

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

do $$
declare
  r record;
  i int;
begin
  for r in select id from public.profiles where crew_code is null loop
    for i in 1..20 loop
      begin
        perform set_config('app.allow_crew_code', '1', true);
        update public.profiles
           set crew_code = public.alloc_crew_code()
         where id = r.id;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
