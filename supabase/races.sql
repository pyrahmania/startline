-- Live race catalog. Run in the Supabase SQL editor after schema.sql.
-- Discover reads this table; the majors in src/data.ts stay as a fallback.

create table if not exists public.races (
  id text primary key,
  date date not null,
  name text not null,
  distances text[] not null default '{}',
  category text not null,
  location text,
  postcode text,
  region text,
  status text not null,
  sources text[] not null default '{}',
  near_york boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists races_date_idx on public.races (date);
create index if not exists races_near_york_idx on public.races (near_york);
create index if not exists races_category_idx on public.races (category);

alter table public.races enable row level security;

drop policy if exists "races readable" on public.races;
create policy "races readable"
  on public.races
  for select
  to anon, authenticated
  using (true);

grant select on public.races to anon, authenticated;

insert into public.races (
  id, date, name, distances, category, location, postcode, region, status, sources, near_york
) values
('2026-09-15-vale-of-york','2026-09-15','Vale of York Half Marathon & 10k',array['10K','Half'],'road','Selby','YO8 3QZ','Yorkshire','listed',array['racecalendar'],true),
('2026-09-16-capernwray','2026-09-16','Capernwray Swimming Championships',array['500m','1000m','1500m'],'swim','Capernwray','','North West','entries_open',array['sientries'],false),
('2026-09-17-clowbridge-5k','2026-09-17','Clowbridge 5k Autumn 3/3',array['5K'],'trail','Clowbridge','','North West','entries_open',array['sientries'],false),
('2026-09-18-beyond-durham','2026-09-18','Beyond Durham 55km Ultra & 25km Trail',array['25K','55K'],'ultra','Durham','DH1 3JU','North East','listed',array['sientries','racecalendar'],false),
('2026-09-19-hardmoors-60','2026-09-19','The Hardmoors 60',array['60 mile'],'ultra','Redcar and Cleveland','TS14 7BB','Yorkshire','entries_closed',array['sientries','racecalendar'],true),
('2026-09-19-y3p-2026','2026-09-19','Yorkshire 3 Peaks 70/100km Ultra 2026',array['70K','100K'],'ultra','Yorkshire','','Yorkshire','entries_closed',array['sientries'],true),
('2026-09-19-pyg-50k','2026-09-19','Ranger Ultras Yorkshire Pen-Y-Ghent 50k',array['50K'],'ultra','Pen-y-ghent','','Yorkshire','entries_closed',array['sientries'],true),
('2026-09-19-heights-ultra','2026-09-19','Heights Ultra Trail',array['Ultra'],'ultra','Huddersfield','HD7 5SN','Yorkshire','listed',array['racecalendar'],true),
('2026-09-19-oktoberfest-leeds','2026-09-19','Oktoberfest Half',array['Half'],'road','Leeds','LS13 1HP','Yorkshire','listed',array['racecalendar'],true),
('2026-09-19-snape-10-5','2026-09-19','Snape 10K and 5K fun run',array['5K','10K'],'road','Snape','DL8 2TR','Yorkshire','listed',array['racecalendar'],true),
('2026-09-19-applecross-du','2026-09-19','21st Applecross Duathlon',array['9 mile run','15 mile bike'],'multisport','Applecross','','Scotland','entries_open',array['sientries'],false),
('2026-09-19-tissington-half','2026-09-19','Tissington Trail Half Marathon Weekend',array['Half'],'trail','Buxton','SK17 0BD','Midlands','listed',array['racecalendar'],false),
('2026-09-19-maze-half','2026-09-19','Lakeland Maze Farm Park Half Marathon',array['Half'],'trail','Cumbria','LA8 0JH','North West','entries_closed',array['sientries','racecalendar'],false),
('2026-09-20-castleford-10k','2026-09-20','The Castleford 10k',array['10K'],'road','Castleford','WF10 2SD','Yorkshire','listed',array['racecalendar'],true),
('2026-09-20-beckbusters','2026-09-20','BeckBusters 10km Race',array['2K','10K'],'road','Bishop Monkton','HG3 3QW','Yorkshire','listed',array['racecalendar'],true),
('2026-09-20-kirkstall-7','2026-09-20','Kirkstall Abbey 7',array['7 mile'],'road','Leeds','LS5 3HE','Yorkshire','listed',array['racecalendar'],true),
('2026-09-20-wateraid-yorks','2026-09-20','Tilbury Douglas Yorkshire Run for WaterAid',array['5K','10K'],'road','Harrogate','LS21 2NP','Yorkshire','listed',array['racecalendar'],true),
('2026-09-20-keswick-half','2026-09-20','Keswick Half Marathon',array['Half'],'road','Keswick','CA12 5EG','North West','listed',array['racecalendar'],false),
('2026-09-20-manchester-fest','2026-09-20','Manchester Running Festival',array['5K','10K','Half'],'road','Heaton Park','M25 0EQ','North West','listed',array['racecalendar'],false),
('2026-09-20-morecambe','2026-09-20','Morecambe Marathon Half and 10k',array['10K','Half','Marathon'],'road','Morecambe','LA4 6BA','North West','listed',array['racecalendar'],false),
('2026-09-23-even-splits-leeds','2026-09-23','Even Splits Leeds 5k Series',array['5K'],'road','Leeds','LS16 8NA','Yorkshire','listed',array['racecalendar'],true),
('2026-09-26-reservoir-dogs','2026-09-26','Punk Panther Yorkshire Reservoir Dogs',array[]::text[],'trail','Yorkshire','','Yorkshire','entries_open',array['sientries'],true),
('2026-09-26-burnley-way','2026-09-26','Burnley Way Ultra & Off-road Marathon',array['Marathon','Ultra'],'ultra','Burnley','','North West','entries_open',array['sientries'],false),
('2026-09-26-fearmanagh','2026-09-26','FEARmanagh Adventure Race',array[]::text[],'adventure','Fermanagh','','Northern Ireland','entries_open',array['sientries'],false),
('2026-09-27-london-10000','2026-09-27','Vitality London 10,000',array['10K'],'road','The Mall','SW1A 2BJ','London','listed',array['racecalendar'],false),
('2026-09-27-wistow-10k','2026-09-27','Wistow 10k',array['5K','10K'],'road','Wistow','YO8 3YP','Yorkshire','listed',array['racecalendar'],true),
('2026-09-27-sutton-park-10k','2026-09-27','Sutton Park 10K',array['10K'],'road','North Yorkshire','YO61','Yorkshire','listed',array['racecalendar'],true),
('2026-09-27-hopton-10k','2026-09-27','Hopton 10k',array['10K'],'road','Mirfield','WF14 8PR','Yorkshire','listed',array['racecalendar'],true),
('2026-09-27-aintree','2026-09-27','Run Aintree Half 10k & 5k',array['5K','10K','Half'],'road','Aintree','L9 5AS','North West','listed',array['racecalendar'],false),
('2026-10-03-ripon-ultra','2026-10-03','Round Ripon Ultra',array['Ultra'],'ultra','Ripon','HG4 3AY','Yorkshire','listed',array['sientries','racecalendar'],true),
('2026-10-04-manchester-half','2026-10-04','Manchester Half Marathon',array['Half'],'road','Manchester','M16 0PX','North West','listed',array['racecalendar'],false),
('2026-10-04-roundhay','2026-10-04','Run Yorkshire Roundhay 5k 10k Half',array['5K','10K','Half'],'road','Leeds','LS8 2HH','Yorkshire','listed',array['racecalendar'],true),
('2026-10-04-morley-10k','2026-10-04','Morley 10K',array['10K'],'road','Leeds','LS27 9FN','Yorkshire','listed',array['racecalendar'],true),
('2026-10-06-headtorch-half','2026-10-06','Punk Panther Autumn Headtorch Half',array['Half'],'trail','Yorkshire','','Yorkshire','entries_open',array['sientries'],true),
('2026-10-09-even-splits-york','2026-10-09','Even Splits York 5k Series',array['5K'],'road','York','YO10 5FG','Yorkshire','listed',array['racecalendar'],true),
('2026-10-10-langdale','2026-10-10','Langdale Horseshoe',array[]::text[],'fell','Langdale','','North West','entries_open',array['sientries'],false),
('2026-10-11-utyd-25','2026-10-11','Ultra Tour Yorkshire Dales 25k',array['25K'],'ultra','Yorkshire Dales','','Yorkshire','entries_open',array['sientries','racecalendar'],true),
('2026-10-11-holmfirth-10k','2026-10-11','Holmfirth 10k',array['10K'],'road','Holmfirth','HD9 2AQ','Yorkshire','listed',array['racecalendar'],true),
('2026-10-18-utyd','2026-10-18','Ultra Tour Yorkshire Dales',array['Ultra'],'ultra','Yorkshire Dales','BD23 5AZ','Yorkshire','listed',array['racecalendar'],true),
('2026-10-24-nidderdale','2026-10-24','Punk Panther Nidderdale Way',array[]::text[],'trail','Nidderdale','HG3 5BD','Yorkshire','entries_open',array['sientries','racecalendar'],true),
('2026-10-24-questars-mynd','2026-10-24','Questars Adventure Race Long Mynd 25HR',array['25hr'],'adventure','Long Mynd','','Midlands','entries_open',array['sientries'],false),
('2026-10-30-lww-halloween','2026-10-30','Halloween Lyke Wake Walk night crossing',array['LWW'],'challenge','North York Moors','','Yorkshire','waiting_list',array['sientries'],true),
('2026-10-31-sutton-bank','2026-10-31','Sutton Bank Sizzler',array['7 mile'],'trail','Sutton Bank','','Yorkshire','entries_open',array['sientries'],true),
('2026-10-31-stone-circle','2026-10-31','The Stone Circle Marathon & Half',array['Half','Marathon'],'trail','Gargrave','','Yorkshire','entries_open',array['sientries'],true),
('2026-11-01-guy-fawkes-10','2026-11-01','Up & Running Guy Fawkes 10',array['10 mile'],'road','Harrogate','HG3 5BD','Yorkshire','listed',array['racecalendar'],true),
('2026-11-01-croft-gp','2026-11-01','Running GP Croft Motor Circuit',array['5K','10K','Half','Marathon'],'road','Croft','DL2 2PL','Yorkshire','listed',array['racecalendar'],true),
('2026-11-07-hardmoors-goathland','2026-11-07','Hardmoors 26.2 Goathland',array['26.2 mile'],'trail','Goathland','','Yorkshire','event_full',array['sientries'],true),
('2026-11-13-even-splits-york','2026-11-13','Even Splits York 5k Series',array['5K'],'road','York','YO10 5FG','Yorkshire','listed',array['racecalendar'],true),
('2026-11-14-wharfedale','2026-11-14','Punk Panther Wharfedale Skyline Trail & Ultra',array['Trail','Ultra'],'ultra','Otley','LS21 1RW','Yorkshire','entries_open',array['sientries','racecalendar'],true),
('2026-11-15-meanwood','2026-11-15','Meanwood Holly Hustle',array['Trail'],'trail','Leeds','LS6 4LD','Yorkshire','listed',array['racecalendar'],true),
('2026-11-22-wensleydale','2026-11-22','The Wensleydale Wedge',array[]::text[],'trail','Wensleydale','','Yorkshire','entries_open',array['sientries'],true),
('2026-11-28-stanza','2026-11-28','Stanza Stones Winter Edition',array[]::text[],'trail','Yorkshire','','Yorkshire','entries_open',array['sientries'],true),
('2026-11-29-abbey-dash','2026-11-29','Leeds Abbey Dash 10K',array['10K'],'road','Leeds','LS1 4DL','Yorkshire','listed',array['racecalendar'],true),
('2026-12-04-even-splits-york','2026-12-04','Even Splits York 5k Series',array['5K'],'road','York','YO10 5FG','Yorkshire','listed',array['racecalendar'],true),
('2026-12-06-bah-humbug','2026-12-06','Bah Humbug 10K',array['10K'],'road','Leeds','LS11 5DJ','Yorkshire','listed',array['racecalendar'],true),
('2026-12-28-jolly-hog','2026-12-28','Jolly Hog Jog',array['10K'],'road','Ripon','HG4 2JT','Yorkshire','listed',array['racecalendar'],true),
('2026-12-31-lww-ny','2026-12-31','New Year Lyke Wake Walk night crossing',array['LWW'],'challenge','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-01-09-hardmoors-15','2027-01-09','Hardmoors 15',array['15 mile'],'ultra','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-01-09-hardmoors-30','2027-01-09','Hardmoors 30',array['30 mile'],'ultra','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-01-10-templenewsam','2027-01-10','Templenewsam 10',array['10 mile'],'road','Leeds','LS15 0AE','Yorkshire','listed',array['racecalendar'],true),
('2027-02-06-harrogate-hustle','2027-02-06','Punk Panther Harrogate Hustle',array[]::text[],'trail','Harrogate','','Yorkshire','entries_open',array['sientries'],true),
('2027-02-07-hardmoors-saltburn','2027-02-07','Hardmoors 26.2 Saltburn',array['26.2 mile'],'trail','Saltburn','','Yorkshire','entries_open',array['sientries'],true),
('2027-02-20-roundhay-50','2027-02-20','Roundhay 50',array['50 mile'],'ultra','Leeds','','Yorkshire','entries_open',array['sientries'],true),
('2027-02-28-snake-lane','2027-02-28','Snake Lane 10',array['10 mile'],'road','York','YO42','Yorkshire','listed',array['racecalendar'],true),
('2027-03-20-hardmoors-55','2027-03-20','The Hardmoors 55',array['55 mile'],'ultra','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-03-20-ct-moors-100','2027-03-20','Community Traverse Moors 100',array['100 mile'],'ultra','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-03-20-ct-c2c-300','2027-03-20','Community Traverse Coast to Coast',array['300K'],'ultra','St Bees to Robin Hood''s Bay','','North','entries_open',array['sientries'],true),
('2027-03-28-leeds-fest','2027-03-28','Leeds Running Festival',array['5K','10K','Half'],'road','Roundhay Park','LS8 2HH','Yorkshire','listed',array['racecalendar'],true),
('2027-04-03-northern-traverse','2027-04-03','Northern Traverse 300km',array['300K'],'ultra','Coast to Coast','','North','waiting_list',array['sientries'],true),
('2027-04-03-woldsman','2027-04-03','Woldsman 30',array['32 mile'],'trail','Yorkshire Wolds','','Yorkshire','entries_open',array['sientries'],true),
('2027-04-04-dales-traverse','2027-04-04','Dales Traverse',array['55K'],'ultra','Yorkshire Dales','','Yorkshire','entries_open',array['sientries'],true),
('2027-04-04-moors-traverse','2027-04-04','Moors Traverse',array['80K'],'ultra','North York Moors','','Yorkshire','entries_open',array['sientries'],true),
('2027-04-10-skipton','2027-04-10','Punk Panther Skipton Skedaddle',array[]::text[],'trail','Skipton','','Yorkshire','entries_open',array['sientries'],true),
('2027-04-24-fellsman','2027-04-24','The Fellsman',array[]::text[],'fell','Yorkshire Dales','','Yorkshire','entries_open',array['sientries'],true),
('2027-05-09-hardmoors-white-horse','2027-05-09','Hardmoors 26.2 White Horse',array['26.2 mile'],'trail','White Horse','','Yorkshire','entries_open',array['sientries'],true),
('2027-05-15-ripon-stinger','2027-05-15','Punk Panther Ripon Stinger',array[]::text[],'trail','Ripon','','Yorkshire','entries_open',array['sientries'],true),
('2027-06-06-wolds-10k','2027-06-06','Top of the Wolds 10k Challenge',array['10K'],'road','York','YO42 1XW','Yorkshire','listed',array['racecalendar'],true),
('2027-06-20-wy-trail','2027-06-20','West Yorkshire Trail Run',array['Half'],'trail','Harewood','LS17 9LG','Yorkshire','listed',array['racecalendar'],true),
('2027-07-03-endure24','2027-07-03','Endure24 Leeds',array['24hr'],'ultra','Bramham Park','LS23 6ND','Yorkshire','listed',array['racecalendar'],true),
('2027-07-23-lakeland-50-100','2027-07-23','Montane Lakeland 50 & 100',array['50 mile','100 mile'],'ultra','Lake District','','North West','entries_open',array['sientries'],false),
('2027-09-18-y3p-2027','2027-09-18','Yorkshire 3 Peaks 70km Ultra 2027',array['70K'],'ultra','Yorkshire','','Yorkshire','opens_later',array['sientries'],true)
on conflict (id) do nothing;
