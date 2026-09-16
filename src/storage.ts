import { emptyState } from "./data";
import type { Persisted } from "./types";

const KEY = "startline.alpha.v1";

export function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Persisted;
    if (parsed?.version !== 2 || !Array.isArray(parsed.season)) return emptyState();
    return {
      version: 2,
      name: typeof parsed.name === "string" ? parsed.name : "",
      city: typeof parsed.city === "string" ? parsed.city : "",
      year: parsed.year === 2027 ? 2027 : 2026,
      units: parsed.units === "mi" ? "mi" : "km",
      season: parsed.season,
      customRaces: parsed.customRaces ?? [],
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: Persisted): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function appUrl(): string {
  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${origin}${base}`;
}

const JOIN_KEY = "startline.join";
const JOIN_RACE_KEY = "startline.join.race";

export function peekJoin(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("join");
    if (q && q.trim()) {
      localStorage.setItem(JOIN_KEY, q.trim());
      return q.trim();
    }
    return localStorage.getItem(JOIN_KEY);
  } catch {
    return null;
  }
}

export function peekJoinRace(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get("race");
    if (q && q.trim()) {
      localStorage.setItem(JOIN_RACE_KEY, q.trim());
      return q.trim();
    }
    return localStorage.getItem(JOIN_RACE_KEY);
  } catch {
    return null;
  }
}

export function stashJoin(code: string, raceKey?: string): void {
  const v = code.trim();
  if (!v) return;
  try {
    localStorage.setItem(JOIN_KEY, v);
    if (raceKey && raceKey.trim()) {
      localStorage.setItem(JOIN_RACE_KEY, raceKey.trim());
    }
  } catch {
    /* ignore */
  }
}

export function clearJoin(): void {
  try {
    localStorage.removeItem(JOIN_KEY);
    localStorage.removeItem(JOIN_RACE_KEY);
    const url = new URL(window.location.href);
    let dirty = false;
    if (url.searchParams.has("join")) {
      url.searchParams.delete("join");
      dirty = true;
    }
    if (url.searchParams.has("race")) {
      url.searchParams.delete("race");
      dirty = true;
    }
    if (dirty) {
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    /* ignore */
  }
}

export function inviteLink(code: string, raceKey?: string): string {
  const join = `${appUrl()}/?join=${encodeURIComponent(code)}`;
  if (raceKey && raceKey.trim()) {
    return `${join}&race=${encodeURIComponent(raceKey.trim())}`;
  }
  return join;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
