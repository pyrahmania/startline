-- Run in the Supabase SQL editor.
-- Add a friend by exact full name when it matches exactly one other person.

create table if not exists public.crew_code_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists crew_code_attempts_user_idx
  on public.crew_code_attempts (user_id, attempted_at desc);

alter table public.crew_code_attempts enable row level security;

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

notify pgrst, 'reload schema';
