import { CATALOG, COUNTRIES, DISTANCES, STATUSES } from "./data";
import type {
  CustomRace,
  Distance,
  RaceView,
  SeasonEntry,
  Status,
  Surface,
  Units,
} from "./types";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function catalogKey(seriesId: string, year: number): string {
  return `${seriesId}:${year}`;
}

export function raceFromCatalog(seriesId: string, year: number): RaceView | null {
  const row = CATALOG.find((r) => r.seriesId === seriesId);
  if (!row) return null;
  const date = row.dates[year];
  if (!date) return null;
  return {
    key: catalogKey(seriesId, year),
    seriesId,
    year,
    name: row.name,
    date,
    city: row.city,
    country: row.country,
    distance: row.distance,
    surface: row.surface,
    custom: false,
  };
}

export function raceFromCustom(race: CustomRace): RaceView {
  const date = parseISO(race.date);
  return {
    key: race.id,
    seriesId: race.id,
    year: date.getFullYear(),
    name: race.name,
    date: race.date,
    city: race.city,
    country: race.country,
    distance: race.distance,
    surface: race.surface,
    custom: true,
    customId: race.id,
  };
}

export function resolveRace(
  entry: Pick<SeasonEntry, "seriesId" | "year" | "customId" | "key">,
  customRaces: CustomRace[],
  extra: RaceView[] = []
): RaceView | null {
  if (entry.customId) {
    const custom = customRaces.find((r) => r.id === entry.customId);
    return custom ? raceFromCustom(custom) : null;
  }
  const catalog = raceFromCatalog(entry.seriesId, entry.year);
  if (catalog) return catalog;
  return (
    extra.find(
      (r) =>
        r.key === entry.key ||
        r.seriesId === entry.seriesId ||
        r.key === entry.seriesId
    ) ?? null
  );
}

export function catalogForYear(year: number): RaceView[] {
  return CATALOG.map((row) => raceFromCatalog(row.seriesId, year))
    .filter((r): r is RaceView => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function formatDay(iso: string): string {
  return pad(parseISO(iso).getDate());
}

export function formatMonth(iso: string): string {
  return MONTHS_SHORT[parseISO(iso).getMonth()].toUpperCase();
}

export function formatLongDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.id === code)?.label ?? code;
}

export function distanceShort(d: Distance): string {
  return DISTANCES.find((x) => x.id === d)?.label ?? d;
}

export function distanceLabel(d: Distance, units: Units): string {
  const table: Record<Distance, { km: string; mi: string }> = {
    "5k": { km: "5 km", mi: "3.1 mi" },
    "10k": { km: "10 km", mi: "6.2 mi" },
    "10mile": { km: "16.1 km", mi: "10 mi" },
    half: { km: "21.1 km", mi: "13.1 mi" },
    marathon: { km: "42.2 km", mi: "26.2 mi" },
    ultra: { km: "Ultra", mi: "Ultra" },
    other: { km: "Other", mi: "Other" },
  };
  return table[d][units];
}

export function surfaceLabel(s: Surface): string {
  return s === "road" ? "Road" : "Trail";
}

export function statusLabel(s: Status): string {
  return STATUSES.find((x) => x.id === s)?.label ?? s;
}

export function visibleToCrew(status: Status): boolean {
  return status !== "thinking";
}

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isDigitCrewCode(raw: string): boolean {
  return /^\d{6}$/.test(raw.replace(/[\s-]/g, ""));
}

export function formatCrewCode(raw: string): string {
  const d = digitsOnly(raw).slice(0, 6);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}

/** Compact 6-digit or leftover hex. Pulls `join` out of a pasted URL. */
export function parseJoinCode(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    const j = u.searchParams.get("join");
    if (j && j.trim()) return parseJoinCode(j);
  } catch {
    /* not a URL */
  }
  const compact = t.replace(/[\s-]/g, "");
  if (/^\d{6}$/.test(compact)) return compact;
  return compact;
}

export function inviteShareText(
  race: { name: string; date: string } | null,
  code: string,
  url?: string
): string {
  const digits = digitsOnly(code) || code.trim();
  const line = race
    ? `I'm on ${race.name} (${formatLongDate(race.date)}). Add me on startline365: ${digits}`
    : `Add me on startline365: ${digits}`;
  return url ? `${line}\n${url}` : line;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function kmValue(d: Distance): number {
  switch (d) {
    case "5k":
      return 5;
    case "10k":
      return 10;
    case "10mile":
      return 16.1;
    case "half":
      return 21.1;
    case "marathon":
      return 42.2;
    case "ultra":
      return 50;
    default:
      return 0;
  }
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function todayISO(): string {
  const n = startOfToday();
  return isoDate(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/** Visible month to open for a season year. Current year → today; otherwise January. */
export function anchorMonth(year: number, from = startOfToday()): number {
  if (year === from.getFullYear()) return from.getMonth();
  return 0;
}

export function daysUntil(iso: string, from = startOfToday()): number {
  const target = parseISO(iso);
  return Math.round((target.getTime() - from.getTime()) / 86400000);
}

export function isUpcoming(iso: string, from = startOfToday()): boolean {
  return daysUntil(iso, from) >= 0;
}

export function countdownLabel(iso: string, from = startOfToday()): string | null {
  const days = daysUntil(iso, from);
  if (days < 0) return null;
  if (days === 0) return "Race day";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `${days} days out`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} out`;
}
