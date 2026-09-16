-- SuperHalfs catalog rows. Run in the SQL editor. Does not delete existing races.
-- Adds optional country + series columns (existing rows stay GB).

alter table public.races add column if not exists country text not null default 'GB';
alter table public.races add column if not exists series text;

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york, country, series
) values
(
  '2026-09-20-copenhagen-half',
  '2026-09-20',
  'Copenhagen Half Marathon',
  array['Half'],
  'road',
  'Copenhagen',
  '',
  'Capital Region',
  'listed',
  array['superhalfs','super halfs','superhalf','https://www.cphhalf.dk/en/','https://www.superhalfs.com/'],
  false,
  'DK',
  'SuperHalfs'
),
(
  '2026-10-04-cardiff-half',
  '2026-10-04',
  'Cardiff Half Marathon',
  array['Half'],
  'road',
  'Cardiff',
  '',
  'Wales',
  'listed',
  array['superhalfs','super halfs','superhalf','https://www.cardiffhalfmarathon.co.uk/','https://www.superhalfs.com/'],
  false,
  'GB',
  'SuperHalfs'
),
(
  '2026-10-25-valencia-half',
  '2026-10-25',
  'Valencia Half Marathon Trinidad Alfonso Zurich',
  array['Half'],
  'road',
  'Valencia',
  '',
  'Valencian Community',
  'listed',
  array['superhalfs','super halfs','superhalf','Valencia Half Marathon','https://www.valenciaciudaddelrunning.com/en/half-marathon/','https://www.superhalfs.com/'],
  false,
  'ES',
  'SuperHalfs'
),
(
  '2027-03-07-lisbon-half',
  '2027-03-07',
  'EDP Lisbon Half Marathon',
  array['Half'],
  'road',
  'Lisbon',
  '',
  'Lisbon',
  'listed',
  array['superhalfs','super halfs','superhalf','Lisbon Half','https://www.meiamaratonadelisboa.com/','https://www.superhalfs.com/'],
  false,
  'PT',
  'SuperHalfs'
),
(
  '2027-04-03-prague-half',
  '2027-04-03',
  'Generali Prague Half Marathon',
  array['Half'],
  'road',
  'Prague',
  '',
  'Prague',
  'listed',
  array['superhalfs','super halfs','superhalf','Prague Half','https://www.runczech.com/','https://www.superhalfs.com/'],
  false,
  'CZ',
  'SuperHalfs'
),
(
  '2027-04-04-berlin-half',
  '2027-04-04',
  'Generali Berlin Half Marathon',
  array['Half'],
  'road',
  'Berlin',
  '',
  'Berlin',
  'listed',
  array['superhalfs','super halfs','superhalf','Berlin Half','https://www.generali-berliner-halbmarathon.de/','https://www.superhalfs.com/'],
  false,
  'DE',
  'SuperHalfs'
),
(
  '2027-09-19-copenhagen-half',
  '2027-09-19',
  'Copenhagen Half Marathon',
  array['Half'],
  'road',
  'Copenhagen',
  '',
  'Capital Region',
  'listed',
  array['superhalfs','super halfs','superhalf','https://www.cphhalf.dk/en/','https://www.superhalfs.com/'],
  false,
  'DK',
  'SuperHalfs'
),
(
  '2027-10-03-cardiff-half',
  '2027-10-03',
  'Cardiff Half Marathon',
  array['Half'],
  'road',
  'Cardiff',
  '',
  'Wales',
  'listed',
  array['superhalfs','super halfs','superhalf','https://www.cardiffhalfmarathon.co.uk/','https://www.superhalfs.com/'],
  false,
  'GB',
  'SuperHalfs'
),
(
  '2027-10-24-valencia-half',
  '2027-10-24',
  'Valencia Half Marathon Trinidad Alfonso Zurich',
  array['Half'],
  'road',
  'Valencia',
  '',
  'Valencian Community',
  'listed',
  array['superhalfs','super halfs','superhalf','Valencia Half Marathon','https://www.valenciaciudaddelrunning.com/en/half-marathon/','https://www.superhalfs.com/'],
  false,
  'ES',
  'SuperHalfs'
)
on conflict (id) do update set
  series = coalesce(nullif(public.races.series, ''), excluded.series),
  country = excluded.country,
  region = coalesce(nullif(public.races.region, ''), excluded.region),
  sources = (
    select array_agg(distinct s)
    from unnest(coalesce(public.races.sources, '{}') || excluded.sources) as s
  );
