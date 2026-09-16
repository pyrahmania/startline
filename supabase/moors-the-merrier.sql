-- Moors the Merrier (CraggRunner). Official: Saturday 12 December 2026,
-- 21-mile circular, Mytholmroyd Community Centre HX7 5AF.
-- Race start 09:00. Entries open on SiEntries. No 2027 date published.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2026-12-12-moors-the-merrier',
  '2026-12-12',
  'Moors the Merrier',
  array['21 mile'],
  'trail',
  'Mytholmroyd',
  'HX7 5AF',
  'Yorkshire',
  'entries_open',
  array[
    'moors the merrier',
    'moors the merrier 21',
    'hebden bridge',
    'mytholmroyd',
    'craggrunner',
    'https://craggrunner.com/moors-the-merrier-20/'
  ],
  true,
  'GB',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  postcode = coalesce(nullif(public.races.postcode, ''), excluded.postcode),
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  status = excluded.status,
  near_york = excluded.near_york,
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
