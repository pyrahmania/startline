-- Liverpool Half Marathon and 10 Mile (BTR Liverpool).
-- Official: Sunday 14 March 2027, 09:30, Hill Dickinson Stadium.
-- 2026 already ran. Two distances, same day.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values
(
  '2027-03-14-liverpool-half',
  '2027-03-14',
  'Liverpool Half Marathon',
  array['Half'],
  'road',
  'Liverpool',
  '',
  'North West',
  'entries_open',
  array[
    'liverpool half',
    'btr liverpool',
    'https://www.btrliverpool.com/events/liverpool-half-marathon-and-10-mile/'
  ],
  false,
  'GB',
  null
),
(
  '2027-03-14-liverpool-10-mile',
  '2027-03-14',
  'Liverpool 10 Mile',
  array['10 mile'],
  'road',
  'Liverpool',
  '',
  'North West',
  'entries_open',
  array[
    'liverpool 10 mile',
    'liverpool 10 miler',
    'btr liverpool',
    'https://www.btrliverpool.com/events/liverpool-half-marathon-and-10-mile/'
  ],
  false,
  'GB',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  status = excluded.status,
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
