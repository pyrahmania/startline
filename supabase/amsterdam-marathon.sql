-- TCS Amsterdam Marathon. Run in the SQL editor. Does not delete existing races.
-- 2026: official program Sunday 18 October. Sold out.
-- 2027: official weekend Sat 30 / Sun 31 October; marathon on Sunday as in 2026.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values
(
  '2026-10-18-amsterdam-marathon',
  '2026-10-18',
  'TCS Amsterdam Marathon',
  array['Marathon'],
  'road',
  'Amsterdam',
  '1076 DE',
  'North Holland',
  'event_full',
  array[
    'amsterdam marathon',
    'tcs amsterdam',
    'https://www.tcsamsterdammarathon.eu/'
  ],
  false,
  'NL',
  null
),
(
  '2027-10-31-amsterdam-marathon',
  '2027-10-31',
  'TCS Amsterdam Marathon',
  array['Marathon'],
  'road',
  'Amsterdam',
  '1076 DE',
  'North Holland',
  'listed',
  array[
    'amsterdam marathon',
    'tcs amsterdam',
    'https://www.tcsamsterdammarathon.eu/'
  ],
  false,
  'NL',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  postcode = coalesce(nullif(public.races.postcode, ''), excluded.postcode),
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  status = excluded.status,
  country = excluded.country,
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
