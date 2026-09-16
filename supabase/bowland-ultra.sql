-- Bowland Ultra and Bowland Trail Half. Official: Saturday 9 January 2027,
-- Slaidburn Village Hall BB7 3ES. Ultra 08:00, half 10:00.
-- 2026 already ran. Do not backfill.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values
(
  '2027-01-09-bowland-ultra',
  '2027-01-09',
  'Bowland Ultra',
  array['42 mile'],
  'trail',
  'Slaidburn',
  'BB7 3ES',
  'North West',
  'entries_open',
  array[
    'bowland ultra',
    'forest of bowland',
    'slaidburn',
    'https://bowlandultra.co.uk/'
  ],
  false,
  'GB',
  'Bowland'
),
(
  '2027-01-09-bowland-trail-half',
  '2027-01-09',
  'Bowland Trail Half',
  array['Half'],
  'trail',
  'Slaidburn',
  'BB7 3ES',
  'North West',
  'entries_open',
  array[
    'bowland trail half',
    'bowland half',
    'forest of bowland',
    'slaidburn',
    'https://bowlandultra.co.uk/'
  ],
  false,
  'GB',
  'Bowland'
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  postcode = coalesce(nullif(public.races.postcode, ''), excluded.postcode),
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  status = excluded.status,
  series = coalesce(public.races.series, excluded.series),
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
