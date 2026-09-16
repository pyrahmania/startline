-- Paris Marathon 2027. Official: Sunday 4 April 2027 (ASICS Marathon de Paris).
-- 2026 already ran (12 April). Lottery for 2027 is open Sep 2026.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2027-04-04-paris-marathon',
  '2027-04-04',
  'Paris Marathon',
  array['Marathon'],
  'road',
  'Paris',
  '',
  'Île-de-France',
  'listed',
  array[
    'paris marathon',
    'marathon de paris',
    'asics marathon de paris',
    'https://www.schneiderelectricparismarathon.com/'
  ],
  false,
  'FR',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  country = excluded.country,
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
