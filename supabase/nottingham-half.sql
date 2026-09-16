-- Robin Hood Half Marathon (Nottingham). Run in the SQL editor.
-- Official date from robinhoodhalfmarathon.co.uk. Does not delete existing races.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2026-09-27-robin-hood-half',
  '2026-09-27',
  'Robin Hood Half Marathon',
  array['Half'],
  'road',
  'Nottingham',
  '',
  'East Midlands',
  'entries_closed',
  array[
    'nottingham half',
    'nottingham half marathon',
    'robin hood half',
    'robinhood half',
    'https://www.robinhoodhalfmarathon.co.uk/'
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
