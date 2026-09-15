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

export function peekJoin(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get("join");
    if (q && q.trim()) {
      localStorage.setItem(JOIN_KEY, q.trim());
      return q.trim();
    }
    return localStorage.getItem(JOIN_KEY);
  } catch {
    return null;
  }
}

export function stashJoin(code: string): void {
  const v = code.trim();
  if (!v) return;
  try {
    localStorage.setItem(JOIN_KEY, v);
  } catch {
    /* ignore */
  }
}

export function clearJoin(): void {
  try {
    localStorage.removeItem(JOIN_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has("join")) {
      url.searchParams.delete("join");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    /* ignore */
  }
}

export function inviteLink(code: string): string {
  return `${appUrl()}/?join=${encodeURIComponent(code)}`;
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
