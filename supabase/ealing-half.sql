-- Ealing Half Marathon. Run in the SQL editor. Does not delete existing races.

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values (
  '2026-09-27-ealing-half',
  '2026-09-27',
  'Ealing Half Marathon',
  array['Half'],
  'road',
  'Ealing',
  'W5 5JH',
  'London',
  'listed',
  array['ealing half','ealinghalf','wizz air ealing','https://ealinghalfmarathon.com/'],
  false,
  'GB',
  null
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  postcode = coalesce(nullif(public.races.postcode, ''), excluded.postcode),
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
