import { isDigitCrewCode } from "../format";
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
  notes?: string;
  finish_time?: string | null;
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

  const [{ error: pErr }, existingSeason, existingCustom] = await Promise.all([
    sb.from("profiles").upsert({
      id: userId,
      name: state.name,
      city: state.city,
      units: state.units,
      year: state.year,
      updated_at: new Date().toISOString(),
    }),
    sb.from("season_entries").select("key").eq("user_id", userId),
    sb.from("custom_races").select("id").eq("user_id", userId),
  ]);
  if (pErr) throw pErr;
  if (existingSeason.error) throw existingSeason.error;
  if (existingCustom.error) throw existingCustom.error;

  const wantKeys = new Set(state.season.map((e) => e.key));
  const dropSeason = (existingSeason.data ?? [])
    .map((r) => r.key as string)
    .filter((k) => !wantKeys.has(k));
  const wantCustom = new Set(state.customRaces.map((r) => r.id));
  const dropCustom = (existingCustom.data ?? [])
    .map((r) => r.id as string)
    .filter((id) => !wantCustom.has(id));

  const deletes: PromiseLike<{ error: { message: string } | null }>[] = [];
  if (dropSeason.length) {
    deletes.push(
      sb.from("season_entries").delete().eq("user_id", userId).in("key", dropSeason)
    );
  }
  if (dropCustom.length) {
    deletes.push(
      sb.from("custom_races").delete().eq("user_id", userId).in("id", dropCustom)
    );
  }
  if (deletes.length) {
    const gone = await Promise.all(deletes);
    const delErr = gone.find((g) => g.error)?.error;
    if (delErr) throw delErr;
  }

  const writes = [];
  if (state.season.length) {
    writes.push(
      sb.from("season_entries").upsert(
        state.season.map((e) => ({
          user_id: userId,
          key: e.key,
          series_id: e.seriesId,
          year: e.year,
          status: e.status,
          notes: e.notes,
          finish_time: e.finishTime ?? null,
          custom_id: e.customId ?? null,
        })),
        { onConflict: "user_id,key" }
      )
    );
  }
  if (state.customRaces.length) {
    writes.push(
      sb.from("custom_races").upsert(
        state.customRaces.map((r) => ({
          id: r.id,
          user_id: userId,
          name: r.name,
          date: r.date,
          city: r.city,
          country: r.country,
          distance: r.distance,
          surface: r.surface,
        })),
        { onConflict: "id" }
      )
    );
  }
  if (writes.length) {
    const saved = await Promise.all(writes);
    const wErr = saved.find((s) => s.error)?.error;
    if (wErr) throw wErr;
  }
}

export async function fetchRaces(): Promise<RaceView[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const full = await sb
    .from("races")
    .select("id,date,name,distances,category,location,postcode,region,status,sources,near_york,country,series")
    .order("date", { ascending: true })
    .limit(1000);
  const result = full.error
    ? await sb
        .from("races")
        .select("id,date,name,distances,category,location,postcode,region,status,sources,near_york")
        .order("date", { ascending: true })
        .limit(1000)
    : full;
  if (result.error) throw result.error;
  return ((result.data ?? []) as DbRaceRow[]).map(raceFromDb);
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
      sb.from("season_entries")
        .select("user_id,key,series_id,year,status,custom_id")
        .in("user_id", ids)
        .neq("status", "thinking"),
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

function asInviteCode(data: unknown): string | null {
  if (typeof data === "string" && data.trim() && data !== "[object Object]") {
    return data.trim();
  }
  return null;
}

function thrownMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const o = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      error_description?: unknown;
    };
    const parts = [o.message, o.details, o.hint, o.error_description].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    if (parts.length) return parts.join(" — ");
  }
  return "";
}

export async function ensureCrewCode(): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const { data, error } = await sb.rpc("ensure_crew_code");
  if (error) throw error;
  const code = asInviteCode(data);
  if (!code) throw new Error("Couldn’t load your code");
  return code;
}

export async function regenerateCrewCode(): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const { data, error } = await sb.rpc("regenerate_crew_code");
  if (error) throw error;
  const code = asInviteCode(data);
  if (!code) throw new Error("Couldn’t make a new code");
  return code;
}

export async function acceptInviteCode(raw: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("not configured");
  const compact = raw.replace(/[\s-]/g, "").trim();
  if (!compact) throw new Error("Enter a 6-digit code");
  if (isDigitCrewCode(compact)) {
    const { error } = await sb.rpc("accept_crew_code", { raw_code: compact });
    if (error) throw error;
    return;
  }
  const { error } = await sb.rpc("accept_invite", { invite_code: compact });
  if (error) throw error;
}

export async function logEvent(
  kind: "invite_sent" | "invite_accepted" | "overlap_created",
  opts: { otherUser?: string; raceKey?: string } = {}
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return;
  const { error } = await sb.from("events").insert({
    kind,
    actor: uid,
    other_user: opts.otherUser ?? null,
    race_key: opts.raceKey ?? null,
  });
  if (error) {
    /* table may not exist until patch-crew.sql is run */
  }
}

export function inviteError(err: unknown): string {
  const raw = thrownMessage(err);
  const m = raw.toLowerCase();
  if (m.includes("not signed in")) return "Sign in first";
  if (m.includes("could not find the function") || m.includes("schema cache")) {
    return "Couldn’t load your code";
  }
  if (m.includes("too many")) return "Too many tries. Wait a few minutes.";
  if (m.includes("invalid code")) return "Enter a 6-digit code";
  if (m.includes("cannot add yourself") || m.includes("own invite") || m.includes("yourself")) {
    return "That’s your own code";
  }
  if (m.includes("code not found") || m.includes("not found")) return "No one has that code";
  if (m.includes("already used")) return "That invite was already used";
  if (m.includes("expired")) return "That invite has expired";
  if (m.includes("couldn’t load your code") || m.includes("couldn’t make a new code")) {
    return raw;
  }
  if (m.includes("[object object]")) return "Couldn’t use that code";
  return raw || "Couldn’t use that code";
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
