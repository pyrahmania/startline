import type { CustomRace, Friend, Persisted, RaceView, SeasonEntry, Units } from "../types";
import { initialsFrom } from "../storage";
import type { AvatarSpec } from "../types";
import { raceFromDb, type DbRaceRow } from "./races";
import { getSupabase } from "./supabase";

const SHAPES: AvatarSpec["shape"][] = ["circle", "squircle", "hex", "diamond", "shield"];
const PALETTES = [
  { bg: "#2A3A4A", fg: "#D7E7F5" },
  { bg: "#4A2C24", fg: "#F3C7B5" },
  { bg: "#24352A", fg: "#C5E3C0" },
  { bg: "#3A2448", fg: "#E4C8F5" },
  { bg: "#2C2A24", fg: "#C9C2B2" },
  { bg: "#1F1E18", fg: "#D6FF2E" },
];

export function avatarForPerson(id: string, name: string): AvatarSpec {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const pal = PALETTES[h % PALETTES.length];
  return {
    initials: initialsFrom(name),
    bg: pal.bg,
    fg: pal.fg,
    shape: SHAPES[h % SHAPES.length],
    pattern: "ring",
  };
}

type ProfileRow = {
  id: string;
  name: string;
  city: string;
  units: Units;
  year: number;
};

type SeasonRow = {
  key: string;
  series_id: string;
  year: number;
  status: SeasonEntry["status"];
  notes: string;
  finish_time: string | null;
  custom_id: string | null;
};

type CustomRow = {
  id: string;
  name: string;
  date: string;
  city: string;
  country: string;
  distance: CustomRace["distance"];
  surface: CustomRace["surface"];
};

export async function fetchMine(userId: string): Promise<Persisted> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const [{ data: profile, error: pErr }, { data: season, error: sErr }, { data: custom, error: cErr }] =
    await Promise.all([
      sb.from("profiles").select("id,name,city,units,year").eq("id", userId).maybeSingle(),
      sb.from("season_entries").select("key,series_id,year,status,notes,finish_time,custom_id").eq("user_id", userId),
      sb.from("custom_races").select("id,name,date,city,country,distance,surface").eq("user_id", userId),
    ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  if (cErr) throw cErr;
  const p = (profile ?? {}) as Partial<ProfileRow>;
  return {
    version: 2,
    name: p.name ?? "",
    city: p.city ?? "",
    year: p.year === 2027 ? 2027 : 2026,
    units: p.units === "mi" ? "mi" : "km",
    season: ((season ?? []) as SeasonRow[]).map(rowToEntry),
    customRaces: ((custom ?? []) as CustomRow[]).map(rowToCustom),
  };
}

export async function pushMine(userId: string, state: Persisted): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error: pErr } = await sb.from("profiles").upsert({
    id: userId,
    name: state.name,
    city: state.city,
    units: state.units,
    year: state.year,
    updated_at: new Date().toISOString(),
  });
  if (pErr) throw pErr;

  const { error: delS } = await sb.from("season_entries").delete().eq("user_id", userId);
  if (delS) throw delS;
  if (state.season.length) {
    const { error } = await sb.from("season_entries").insert(
      state.season.map((e) => ({
        user_id: userId,
        key: e.key,
        series_id: e.seriesId,
        year: e.year,
        status: e.status,
        notes: e.notes,
        finish_time: e.finishTime ?? null,
        custom_id: e.customId ?? null,
      }))
    );
    if (error) throw error;
  }

  const { error: delC } = await sb.from("custom_races").delete().eq("user_id", userId);
  if (delC) throw delC;
  if (state.customRaces.length) {
    const { error } = await sb.from("custom_races").insert(
      state.customRaces.map((r) => ({
        id: r.id,
        user_id: userId,
        name: r.name,
        date: r.date,
        city: r.city,
        country: r.country,
        distance: r.distance,
        surface: r.surface,
      }))
    );
    if (error) throw error;
  }
}

export async function fetchRaces(): Promise<RaceView[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("races")
    .select("id,date,name,distances,category,location,postcode,region,status,sources,near_york")
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbRaceRow[]).map(raceFromDb);
}

export async function fetchCrew(userId: string): Promise<Friend[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: links, error: lErr } = await sb
    .from("crew_links")
    .select("user_a,user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  if (lErr) throw lErr;
  const ids = [...new Set((links ?? []).map((l) => (l.user_a === userId ? l.user_b : l.user_a)))];
  if (!ids.length) return [];

  const [{ data: profiles, error: pErr }, { data: season, error: sErr }, { data: custom, error: cErr }] =
    await Promise.all([
      sb.from("profiles").select("id,name,city,units,year").in("id", ids),
      sb.from("season_entries").select("user_id,key,series_id,year,status,notes,finish_time,custom_id").in("user_id", ids),
      sb.from("custom_races").select("id,user_id,name,date,city,country,distance,surface").in("user_id", ids),
    ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  if (cErr) throw cErr;

  return ((profiles ?? []) as ProfileRow[]).map((p) => {
    const entries = ((season ?? []) as (SeasonRow & { user_id: string })[])
      .filter((e) => e.user_id === p.id)
      .map(rowToEntry);
    const customs = ((custom ?? []) as (CustomRow & { user_id: string })[])
      .filter((c) => c.user_id === p.id)
      .map(rowToCustom);
    return {
      id: p.id,
      name: p.name || "Runner",
      city: p.city || "",
      avatar: avatarForPerson(p.id, p.name || "Runner"),
      season: entries,
      customRaces: customs,
    } satisfies Friend & { customRaces: CustomRace[] };
  });
}

export async function createInviteCode(): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const { data, error } = await sb.rpc("create_invite");
  if (!error && data) return String(data);

  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw error ?? new Error("not signed in");
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insErr } = await sb.from("invites").insert({
    code,
    from_user: uid,
    expires_at: expires,
  });
  if (insErr) throw error ?? insErr;
  return code;
}

export async function acceptInviteCode(code: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const { error } = await sb.rpc("accept_invite", { invite_code: code.trim() });
  if (error) throw error;
}

export function inviteError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();
  if (m.includes("not signed in")) return "Sign in first";
  if (m.includes("not found")) return "Invite not found";
  if (m.includes("already used")) return "That invite was already used";
  if (m.includes("expired")) return "That invite has expired";
  if (m.includes("own invite")) return "That’s your own invite link";
  return raw || "Couldn’t use that invite";
}

function rowToEntry(row: SeasonRow): SeasonEntry {
  return {
    key: row.key,
    seriesId: row.series_id,
    year: row.year,
    status: row.status,
    notes: row.notes ?? "",
    finishTime: row.finish_time ?? undefined,
    customId: row.custom_id ?? undefined,
  };
}

function rowToCustom(row: CustomRow): CustomRace {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    city: row.city,
    country: row.country,
    distance: row.distance,
    surface: row.surface,
  };
}
