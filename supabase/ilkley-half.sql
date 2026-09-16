-- Ilkley Half Marathon. Official: Sunday 12 July 2026, 10:30, Ilkley, West Yorkshire.
-- 2026 already ran (today is after 12 Jul). Discover hides past dates.
-- No 2027 date published on ilkleyhalfmarathon.co.uk.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2026-07-12-ilkley-half',
  '2026-07-12',
  'Ilkley Half Marathon',
  array['Half'],
  'road',
  'Ilkley',
  '',
  'Yorkshire',
  'listed',
  array[
    'ilkley half',
    'ihm',
    'https://ilkleyhalfmarathon.co.uk/'
  ],
  true,
  'GB',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  near_york = excluded.near_york,
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
