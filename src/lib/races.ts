import { catalogForYear, countryLabel, kmValue, parseISO } from "../format";
import type { Distance, RaceView, Surface } from "../types";

export type DbRaceRow = {
  id: string;
  date: string;
  name: string;
  distances: string[] | null;
  category: string;
  location: string | null;
  postcode: string | null;
  region: string | null;
  status: string;
  sources: string[] | null;
  near_york: boolean;
  country?: string | null;
  series?: string | null;
};

export function parseDistanceToken(raw: string): Distance {
  const s = raw.trim().toLowerCase();
  const compact = s.replace(/\s+/g, "");
  if (compact === "5k" || compact === "5km") return "5k";
  if (compact === "10k" || compact === "10km") return "10k";
  if (compact === "10mile" || compact === "10mi" || s === "10 mile") return "10mile";
  if (compact === "half" || compact === "halfmarathon") return "half";
  if (compact === "marathon" || compact === "26.2mile" || compact === "26.2") {
    return "marathon";
  }
  if (compact.includes("ultra")) return "ultra";
  const km = compact.match(/^(\d+(?:\.\d+)?)k(?:m)?$/);
  if (km) {
    const n = Number(km[1]);
    if (n === 5) return "5k";
    if (n === 10) return "10k";
    if (n >= 21 && n <= 22) return "half";
    if (n >= 42 && n < 45) return "marathon";
    if (n >= 25) return "ultra";
    return "other";
  }
  const miles = compact.match(/^(\d+(?:\.\d+)?)(?:mile|mi)$/);
  if (miles) {
    const n = Number(miles[1]);
    if (n === 10) return "10mile";
    if (n >= 13 && n <= 14) return "half";
    if (n >= 26 && n <= 27) return "marathon";
    if (n >= 30) return "ultra";
    return "other";
  }
  return "other";
}

function surfaceFromCategory(category: string): Surface {
  return category.trim().toLowerCase() === "road" ? "road" : "trail";
}

function primaryDistance(tags: Distance[], category: string): Distance {
  if (tags.length === 0) {
    return category.trim().toLowerCase() === "ultra" ? "ultra" : "other";
  }
  return tags.slice().sort((a, b) => kmValue(b) - kmValue(a))[0];
}

export function raceFromDb(row: DbRaceRow): RaceView {
  const labels = (row.distances ?? []).map((d) => d.trim()).filter(Boolean);
  const tags = [
    ...new Set(
      labels
        .map(parseDistanceToken)
        .filter((d) => d !== "other" || labels.length === 1)
    ),
  ];
  const category = row.category ?? "";
  if (tags.length === 0 && category.toLowerCase() === "ultra") tags.push("ultra");
  if (tags.length === 0) tags.push("other");
  const date = String(row.date).slice(0, 10);
  const year = parseISO(date).getFullYear();
  return {
    key: row.id,
    seriesId: row.id,
    year,
    name: row.name,
    date,
    city: (row.location || row.region || "").trim(),
    country: (row.country || "GB").trim().toUpperCase() || "GB",
    distance: primaryDistance(tags, category),
    surface: surfaceFromCategory(category),
    custom: false,
    nearYork: Boolean(row.near_york),
    region: row.region ?? undefined,
    entryStatus: row.status || undefined,
    distanceTags: tags,
    distanceLabels: labels,
    series: row.series?.trim() || undefined,
    sources: (row.sources ?? []).filter(Boolean),
  };
}

export function raceSearchText(r: {
  name: string;
  city: string;
  country?: string;
  region?: string;
  series?: string;
  sources?: string[];
}): string {
  const country = r.country
    ? `${r.country} ${countryLabel(r.country)}`
    : "";
  return [
    r.name,
    r.city,
    country,
    r.region ?? "",
    r.series ?? "",
    ...(r.sources ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|tcs|bmw|vitality|montane)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarName(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = nb.split(" ").filter((t) => t.length > 2);
  const shared = tb.filter((t) => ta.has(t));
  const need = Math.min(2, Math.min(ta.size, tb.length));
  return shared.length >= need && need > 0;
}

function sameRace(a: RaceView, b: RaceView): boolean {
  const days =
    Math.abs(parseISO(a.date).getTime() - parseISO(b.date).getTime()) / 86400000;
  return days <= 10 && similarName(a.name, b.name);
}

/** DB rows for the year, plus majors that aren't already in the table. */
export function mergeCatalog(year: number, dbRaces: RaceView[]): RaceView[] {
  const fromDb = dbRaces.filter((r) => r.year === year);
  const out = [...fromDb];
  for (const row of catalogForYear(year)) {
    if (out.some((r) => sameRace(r, row))) continue;
    out.push(row);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function entryStatusLabel(status?: string): string | null {
  switch (status) {
    case "entries_open":
      return "Entries open";
    case "entries_closed":
      return "Entries closed";
    case "event_full":
      return "Event full";
    case "waiting_list":
      return "Waiting list";
    case "opens_later":
      return "Entries open later";
    default:
      return null;
  }
}
