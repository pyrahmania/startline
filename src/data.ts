import type {
  AvatarSpec,
  CatalogRace,
  Distance,
  Friend,
  Persisted,
  SeasonEntry,
  Status,
  Surface,
} from "./types";

export const USER = {
  name: "Alex",
  city: "York",
  country: "GB",
  avatar: {
    initials: "AX",
    bg: "#1F1E18",
    fg: "#D6FF2E",
    shape: "squircle",
    pattern: "ring",
  } satisfies AvatarSpec,
};

export const DISTANCES: { id: Distance; label: string }[] = [
  { id: "5k", label: "5K" },
  { id: "10k", label: "10K" },
  { id: "10mile", label: "10 mile" },
  { id: "half", label: "Half" },
  { id: "marathon", label: "Marathon" },
  { id: "ultra", label: "Ultra" },
  { id: "other", label: "Other" },
];

export const SURFACES: { id: Surface; label: string }[] = [
  { id: "road", label: "Road" },
  { id: "trail", label: "Trail" },
];

export const STATUSES: { id: Status; label: string }[] = [
  { id: "thinking", label: "Thinking" },
  { id: "signed_up", label: "Signed up" },
  { id: "training", label: "Training" },
  { id: "done", label: "Done" },
];

export const COUNTRIES: { id: string; label: string }[] = [
  { id: "GB", label: "UK" },
  { id: "US", label: "USA" },
  { id: "DE", label: "Germany" },
  { id: "ES", label: "Spain" },
  { id: "DK", label: "Denmark" },
  { id: "FR", label: "France" },
  { id: "PT", label: "Portugal" },
  { id: "CZ", label: "Czechia" },
  { id: "NL", label: "Netherlands" },
];

function cat(
  seriesId: string,
  name: string,
  city: string,
  country: string,
  distance: Distance,
  surface: Surface,
  d2026: string,
  d2027: string
): CatalogRace {
  return {
    seriesId,
    name,
    city,
    country,
    distance,
    surface,
    dates: {
      2026: `2026-${d2026}`,
      2027: `2027-${d2027}`,
    },
  };
}

export const CATALOG: CatalogRace[] = [
  cat("national-xc", "National Cross Country", "London", "GB", "10k", "trail", "02-21", "02-27"),
  cat("reading-half", "Reading Half Marathon", "Reading", "GB", "half", "road", "03-01", "03-21"),
  cat("knavesmire-5k", "Knavesmire 5K", "York", "GB", "5k", "road", "03-14", "03-14"),
  cat("bath-half", "Bath Half", "Bath", "GB", "half", "road", "03-15", "03-14"),
  cat("folkestone-10", "Folkestone 10", "Folkestone", "GB", "10mile", "road", "03-29", "03-28"),
  cat("london-landmarks-half", "London Landmarks Half", "London", "GB", "half", "road", "04-05", "04-04"),
  cat("brighton-marathon", "Brighton Marathon", "Brighton", "GB", "marathon", "road", "04-12", "04-04"),
  cat("manchester-marathon", "Manchester Marathon", "Manchester", "GB", "marathon", "road", "04-12", "04-18"),
  cat("boston-marathon", "Boston Marathon", "Boston", "US", "marathon", "road", "04-20", "04-19"),
  cat("london-marathon", "TCS London Marathon", "London", "GB", "marathon", "road", "04-26", "04-25"),
  cat("south-downs-way-50", "South Downs Way 50", "Eastbourne", "GB", "ultra", "trail", "06-13", "04-10"),
  cat("ultra-trail-snowdonia", "Ultra-Trail Snowdonia", "Llanberis", "GB", "ultra", "trail", "05-09", "05-08"),
  cat("leeds-half", "Leeds Half Marathon", "Leeds", "GB", "half", "road", "05-10", "05-09"),
  cat("north-downs-way-50", "North Downs Way 50", "Farnham", "GB", "ultra", "trail", "05-16", "05-15"),
  cat("manchester-half", "Manchester Half", "Manchester", "GB", "half", "road", "05-17", "05-23"),
  cat("edinburgh-marathon", "Edinburgh Marathon", "Edinburgh", "GB", "marathon", "road", "05-24", "05-30"),
  cat("vitality-london-10000", "Vitality London 10,000", "London", "GB", "10k", "road", "05-25", "09-26"),
  cat("roundhay-5k", "Roundhay 5K", "Leeds", "GB", "5k", "road", "06-20", "06-20"),
  cat("snowdonia-trail-marathon", "Snowdonia Trail Marathon", "Llanberis", "GB", "marathon", "trail", "07-18", "07-11"),
  cat("lakeland-50", "Lakeland 50", "Coniston", "GB", "ultra", "trail", "07-25", "07-24"),
  cat("york-10k", "York 10K", "York", "GB", "10k", "road", "08-02", "08-01"),
  cat("utmb", "UTMB", "Chamonix", "FR", "ultra", "trail", "08-28", "08-27"),
  cat("keswick-trail-10k", "Keswick Trail 10K", "Keswick", "GB", "10k", "trail", "09-05", "09-04"),
  cat("hardmoors-60", "Hardmoors 60", "Guisborough", "GB", "ultra", "trail", "09-12", "09-18"),
  cat("great-north-run", "Great North Run", "Newcastle", "GB", "half", "road", "09-13", "09-12"),
  cat("copenhagen-half", "Copenhagen Half", "Copenhagen", "DK", "half", "road", "09-20", "09-19"),
  cat("berlin-marathon", "BMW Berlin Marathon", "Berlin", "DE", "marathon", "road", "09-27", "09-26"),
  cat("great-scottish-run", "Great Scottish Run", "Glasgow", "GB", "half", "road", "09-27", "10-03"),
  cat("kielder-marathon", "Kielder Marathon", "Kielder", "GB", "marathon", "trail", "10-04", "10-03"),
  cat("chicago-marathon", "Chicago Marathon", "Chicago", "US", "marathon", "road", "10-11", "10-10"),
  cat("royal-parks-half", "Royal Parks Half", "London", "GB", "half", "road", "10-11", "10-10"),
  cat("yorkshire-marathon", "Yorkshire Marathon", "York", "GB", "marathon", "road", "10-18", "10-17"),
  cat("nyc-marathon", "TCS New York City Marathon", "New York", "US", "marathon", "road", "11-01", "11-07"),
  cat("york-frost-5k", "York Christmas Cracker 5K", "York", "GB", "5k", "road", "12-06", "12-05"),
  cat("valencia-marathon", "Valencia Marathon", "Valencia", "ES", "marathon", "road", "12-06", "12-05"),
];

function entry(
  seriesId: string,
  year: number,
  status: Status,
  notes = "",
  finishTime?: string
): SeasonEntry {
  return {
    key: `${seriesId}:${year}`,
    seriesId,
    year,
    status,
    notes,
    finishTime,
  };
}

export const FRIENDS: Friend[] = [
  {
    id: "sam",
    name: "Sam",
    city: "Leeds",
    avatar: {
      initials: "SM",
      bg: "#2A3A4A",
      fg: "#D7E7F5",
      shape: "circle",
      pattern: "split",
    },
    season: [
      entry("manchester-half", 2026, "signed_up", "Trying to break 1:40."),
      entry("london-marathon", 2026, "training", "Charity place. Long runs on canal."),
    ],
  },
  {
    id: "priya",
    name: "Priya",
    city: "York",
    avatar: {
      initials: "PR",
      bg: "#4A2C24",
      fg: "#F3C7B5",
      shape: "hex",
      pattern: "dot",
    },
    season: [
      entry("york-10k", 2026, "signed_up", "Home course. Hang on to 4:05s."),
      entry(
        "snowdonia-trail-marathon",
        2026,
        "training",
        "First proper mountain day."
      ),
    ],
  },
  {
    id: "jordan",
    name: "Jordan",
    city: "Sheffield",
    avatar: {
      initials: "JD",
      bg: "#24352A",
      fg: "#C5E3C0",
      shape: "diamond",
      pattern: "bars",
    },
    season: [
      entry("lakeland-50", 2026, "signed_up", "Recce the climbs in June."),
      entry("hardmoors-60", 2026, "thinking", "If the legs recover."),
    ],
  },
  {
    id: "mei",
    name: "Mei",
    city: "Manchester",
    avatar: {
      initials: "ME",
      bg: "#3A2448",
      fg: "#E4C8F5",
      shape: "shield",
      pattern: "ring",
    },
    season: [
      entry("manchester-half", 2026, "signed_up", "Home half. Pacing Sam."),
      entry("yorkshire-marathon", 2026, "signed_up", "Train together?"),
    ],
  },
  {
    id: "chris",
    name: "Chris",
    city: "Hull",
    avatar: {
      initials: "CH",
      bg: "#2C2A24",
      fg: "#C9C2B2",
      shape: "squircle",
      pattern: "solid",
    },
    season: [],
  },
];

export const SAMPLE_SEASON: SeasonEntry[] = [
  entry(
    "manchester-half",
    2026,
    "signed_up",
    "Long-run dress rehearsal for autumn."
  ),
  entry("york-10k", 2026, "signed_up", "PB hunt. Hang at 4:00/km through 7k."),
  entry(
    "yorkshire-marathon",
    2026,
    "thinking",
    "Ballot / charity place still open."
  ),
  entry("york-frost-5k", 2026, "done", "Icy but honest.", "21:48"),
];

export function emptyState(): Persisted {
  return {
    version: 2,
    name: "",
    city: "",
    year: 2026,
    units: "km",
    customRaces: [],
    season: [],
  };
}
