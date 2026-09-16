-- Brass Monkey Half Marathon (York Knavesmire Harriers).
-- Official: Sunday 17 January 2027, 10:00, York Racecourse YO23 1EX.
-- 2026 already ran (18 Jan). Do not backfill.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2027-01-17-brass-monkey',
  '2027-01-17',
  'Brass Monkey Half Marathon',
  array['Half'],
  'road',
  'York',
  'YO23 1EX',
  'Yorkshire',
  'opens_later',
  array[
    'brass monkey',
    'york brass monkey',
    'knavesmire',
    'https://www.yorkknavesmireharriers.co.uk/brass-monkey/'
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
