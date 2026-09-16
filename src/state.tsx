import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FRIENDS, SAMPLE_SEASON } from "./data";
import {
  catalogKey,
  inviteShareText,
  parseJoinCode,
  raceFromCatalog,
  raceFromCustom,
  resolveRace,
  visibleToCrew,
} from "./format";
import { mergeCatalog } from "./lib/races";
import {
  acceptInviteCode,
  ensureCrewCode,
  fetchCrew,
  fetchMine,
  fetchRaces,
  inviteError,
  pushMine,
  regenerateCrewCode,
} from "./lib/remote";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import {
  appUrl,
  clearJoin,
  inviteLink,
  loadState,
  peekJoin,
  peekJoinRace,
  saveState,
} from "./storage";
import type {
  CustomRace,
  Friend,
  Persisted,
  RaceView,
  SeasonEntry,
  Status,
  Units,
} from "./types";

type AddCustomInput = Omit<CustomRace, "id">;

export type JoinNotice =
  | { kind: "joined"; name: string; raceKey?: string | null }
  | { kind: "error"; message: string };

export type InvitePayload = {
  url: string;
  text: string;
  code: string;
  raceKey?: string;
};

type Store = {
  configured: boolean;
  authReady: boolean;
  hydrated: boolean;
  signedIn: boolean;
  email: string | null;
  name: string;
  city: string;
  year: number;
  units: Units;
  season: SeasonEntry[];
  customRaces: CustomRace[];
  crew: Friend[];
  exampleCrew: boolean;
  crewCode: string | null;
  hasPendingJoin: boolean;
  joinNotice: JoinNotice | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  createInvite: (raceKey?: string) => Promise<InvitePayload>;
  regenerateCode: () => Promise<string>;
  refreshCode: () => Promise<string>;
  refreshCrew: () => Promise<void>;
  redeemInvite: (code: string) => Promise<string>;
  clearJoinNotice: () => void;
  setProfile: (name: string, city: string) => void;
  setYear: (year: number) => void;
  setUnits: (units: Units) => void;
  mySeason: SeasonEntry[];
  races: RaceView[];
  allRaces: RaceView[];
  resolve: (entry: SeasonEntry, customs?: CustomRace[]) => RaceView | null;
  raceByKey: (key: string) => RaceView | null;
  myEntry: (key: string) => SeasonEntry | undefined;
  addCatalog: (seriesId: string, year: number, status: Status) => string;
  addCustom: (input: AddCustomInput, status: Status) => string;
  setStatus: (key: string, status: Status) => void;
  setNotes: (key: string, notes: string) => void;
  setFinishTime: (key: string, finishTime: string) => void;
  remove: (key: string) => void;
  friendsOn: (seriesId: string, year: number) => { friend: Friend; entry: SeasonEntry }[];
  sharedWith: (friend: Friend) => RaceView[];
  loadSample: () => void;
  clearSeason: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [authReady, setAuthReady] = useState(!configured);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<Persisted>(() => loadState());
  const [crew, setCrew] = useState<Friend[]>([]);
  const [crewCode, setCrewCode] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!configured);
  const [joinNotice, setJoinNotice] = useState<JoinNotice | null>(null);
  const [pendingJoin, setPendingJoin] = useState(() => Boolean(peekJoin()));
  const [dbRaces, setDbRaces] = useState<RaceView[]>([]);
  const skipPush = useRef(true);
  const lastPush = useRef("");
  const crewFetchedAt = useRef(0);
  const userIdRef = useRef(userId);
  const crewRef = useRef(crew);
  userIdRef.current = userId;
  crewRef.current = crew;

  const refreshCrew = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    const now = Date.now();
    if (now - crewFetchedAt.current < 15000) return;
    const list = await fetchCrew(id);
    crewFetchedAt.current = Date.now();
    setCrew(list);
  }, []);

  const redeemInvite = useCallback(async (raw: string) => {
    const id = userIdRef.current;
    if (!id) throw new Error("Sign in first");
    const code = parseJoinCode(raw);
    if (!code) throw new Error("Enter a 6-digit code");
    await acceptInviteCode(code);
    clearJoin();
    setPendingJoin(false);
    const prev = crewRef.current;
    const list = await fetchCrew(id);
    crewFetchedAt.current = Date.now();
    setCrew(list);
    const added = list.find((f) => !prev.some((p) => p.id === f.id));
    return added?.name ?? "";
  }, []);

  const refreshCode = useCallback(async () => {
    const code = await ensureCrewCode();
    setCrewCode(code);
    return code;
  }, []);

  useEffect(() => {
    peekJoin();
    peekJoinRace();
  }, []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetchRaces()
      .then((rows) => {
        if (!cancelled) setDbRaces(rows);
      })
      .catch(() => {
        if (!cancelled) setDbRaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured) return;
    if (!userId) {
      skipPush.current = true;
      setCrewCode(null);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    skipPush.current = true;
    (async () => {
      let next = loadState();
      try {
        const remote = await fetchMine(userId);
        const local = loadState();
        const shouldMigrate =
          !remote.name &&
          !remote.season.length &&
          (Boolean(local.name) || local.season.length > 0);
        next = shouldMigrate ? { ...local, version: 2 as const } : remote;
        if (shouldMigrate) await pushMine(userId, next);
      } catch {
        /* keep local season if remote is down */
      }
      try {
        const code = await ensureCrewCode();
        if (!cancelled) setCrewCode(code);
      } catch {
        if (!cancelled) setCrewCode(null);
      }

      const join = peekJoin();
      if (join) {
        try {
          await acceptInviteCode(parseJoinCode(join));
          clearJoin();
          setPendingJoin(false);
          const crewList = await fetchCrew(userId);
          crewFetchedAt.current = Date.now();
          const pal = crewList.find((f) => f.id !== userId) ?? crewList[0];
          const raceKey = peekJoinRace();
          setJoinNotice({
            kind: "joined",
            name: pal?.name?.trim() || "your crew",
            raceKey,
          });
          if (cancelled) return;
          setState(next);
          setCrew(crewList);
          setHydrated(true);
          skipPush.current = false;
          return;
        } catch (err) {
          const message = inviteError(err);
          const own = /own code|yourself|own invite/.test(message.toLowerCase());
          const used = message.toLowerCase().includes("already used");
          const expired = message.toLowerCase().includes("expired");
          const missing = /no one has that code|not found/.test(message.toLowerCase());
          const throttled = message.toLowerCase().includes("too many");
          if (throttled) {
            setJoinNotice({ kind: "error", message });
          } else if (own || used || expired || missing) {
            clearJoin();
            setPendingJoin(false);
            setJoinNotice({ kind: "error", message });
          }
        }
      }
      const crewList = await fetchCrew(userId);
      if (cancelled) return;
      crewFetchedAt.current = Date.now();
      setState(next);
      setCrew(crewList);
      setHydrated(true);
      skipPush.current = false;
    })().catch(() => {
      if (!cancelled) {
        setHydrated(true);
        skipPush.current = false;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [configured, userId]);

  useEffect(() => {
    saveState(state);
    if (!userId || !hydrated || skipPush.current) return;
    const snap = JSON.stringify({
      name: state.name,
      city: state.city,
      year: state.year,
      units: state.units,
      season: state.season,
      customRaces: state.customRaces,
    });
    const t = window.setTimeout(() => {
      if (snap === lastPush.current) return;
      lastPush.current = snap;
      pushMine(userId, state).catch(() => {
        lastPush.current = "";
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, userId, hydrated]);

  const value = useMemo<Store>(() => {
    const displayFriends = configured ? crew : FRIENDS;
    const races2026 = mergeCatalog(2026, dbRaces);
    const races2027 = mergeCatalog(2027, dbRaces);
    const races = state.year === 2027 ? races2027 : races2026;
    const allRaces = state.year === 2027 ? races2027.concat(races2026) : races2026.concat(races2027);

    const mySeason = state.season
      .filter((e) => e.year === state.year)
      .slice()
      .sort((a, b) => {
        const ra = resolveRace(a, state.customRaces, dbRaces);
        const rb = resolveRace(b, state.customRaces, dbRaces);
        return (ra?.date ?? "").localeCompare(rb?.date ?? "");
      });

    const resolve = (entry: SeasonEntry, customs = state.customRaces) =>
      resolveRace(entry, customs, dbRaces);

    const raceByKey = (key: string): RaceView | null => {
      const mine = state.season.find((e) => e.key === key);
      if (mine) return resolve(mine);
      const custom = state.customRaces.find((r) => r.id === key);
      if (custom) return raceFromCustom(custom);
      const fromDb = dbRaces.find((r) => r.key === key || r.seriesId === key);
      if (fromDb) return fromDb;
      const [seriesId, yearStr] = key.split(":");
      const year = Number(yearStr);
      if (seriesId && year) {
        const catalog = raceFromCatalog(seriesId, year);
        if (catalog) return catalog;
      }
      for (const friend of displayFriends) {
        const entry = friend.season.find((e) => e.key === key || e.seriesId === key);
        if (entry) {
          const race = resolveRace(entry, friend.customRaces ?? [], dbRaces);
          if (race) return race;
        }
        const palCustom = (friend.customRaces ?? []).find((r) => r.id === key);
        if (palCustom) return raceFromCustom(palCustom);
      }
      return races.find((r) => r.key === key) ?? allRaces.find((r) => r.key === key) ?? null;
    };

    const myEntry = (key: string) => state.season.find((e) => e.key === key);

    const patch = (fn: (prev: Persisted) => Persisted) => setState((prev) => fn(prev));

    return {
      configured,
      authReady,
      hydrated,
      signedIn: Boolean(userId),
      email,
      name: state.name,
      city: state.city,
      year: state.year,
      units: state.units,
      season: state.season,
      customRaces: state.customRaces,
      crew: displayFriends,
      exampleCrew: !configured,
      crewCode,
      hasPendingJoin: pendingJoin,
      joinNotice,
      signIn: async (addr: string) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Sign-in is not configured");
        const join = peekJoin();
        const race = peekJoinRace();
        const joinCode = join ? parseJoinCode(join) : "";
        if (joinCode) setPendingJoin(true);
        let redirect = `${appUrl()}/`;
        if (joinCode) {
          redirect = `${appUrl()}/?join=${encodeURIComponent(joinCode)}`;
          if (race) redirect += `&race=${encodeURIComponent(race)}`;
        }
        const { error } = await sb.auth.signInWithOtp({
          email: addr.trim(),
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
      },
      signOut: async () => {
        const sb = getSupabase();
        if (sb) await sb.auth.signOut();
        setUserId(null);
        setEmail(null);
        setCrew([]);
        setCrewCode(null);
      },
      createInvite: async (raceKey?: string) => {
        let code = crewCode;
        if (!code) code = await refreshCode();
        const url = inviteLink(code, raceKey);
        const race = raceKey ? raceByKey(raceKey) : null;
        return {
          url,
          text: inviteShareText(race, code, url),
          code,
          raceKey,
        };
      },
      regenerateCode: async () => {
        const next = await regenerateCrewCode();
        setCrewCode(next);
        return next;
      },
      refreshCode,
      refreshCrew,
      redeemInvite,
      clearJoinNotice: () => setJoinNotice(null),
      setProfile: (name, city) =>
        patch((p) => ({ ...p, name: name.trim(), city: city.trim() })),
      setYear: (year) => patch((p) => ({ ...p, year })),
      setUnits: (units) => patch((p) => ({ ...p, units })),
      mySeason,
      races,
      allRaces,
      resolve,
      raceByKey,
      myEntry,
      addCatalog: (seriesId, year, status) => {
        const db = dbRaces.find(
          (r) =>
            (r.seriesId === seriesId || r.key === seriesId) && r.year === year
        );
        const key = db ? db.key : catalogKey(seriesId, year);
        const sid = db ? db.seriesId : seriesId;
        patch((p) => {
          if (p.season.some((e) => e.key === key || e.seriesId === sid)) {
            return { ...p, year };
          }
          return {
            ...p,
            year,
            season: [...p.season, { key, seriesId: sid, year, status, notes: "" }],
          };
        });
        return key;
      },
      addCustom: (input, status) => {
        const id = `custom-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const year = Number(input.date.slice(0, 4));
        const race: CustomRace = { ...input, id };
        patch((p) => ({
          ...p,
          year: year === 2027 ? 2027 : year === 2026 ? 2026 : p.year,
          customRaces: [...p.customRaces, race],
          season: [
            ...p.season,
            { key: id, seriesId: id, year, status, notes: "", customId: id },
          ],
        }));
        return id;
      },
      setStatus: (key, status) =>
        patch((p) => ({
          ...p,
          season: p.season.map((e) =>
            e.key === key
              ? { ...e, status, finishTime: status === "done" ? e.finishTime : undefined }
              : e
          ),
        })),
      setNotes: (key, notes) =>
        patch((p) => ({
          ...p,
          season: p.season.map((e) => (e.key === key ? { ...e, notes } : e)),
        })),
      setFinishTime: (key, finishTime) =>
        patch((p) => ({
          ...p,
          season: p.season.map((e) => (e.key === key ? { ...e, finishTime } : e)),
        })),
      remove: (key) =>
        patch((p) => ({
          ...p,
          season: p.season.filter((e) => e.key !== key),
        })),
      friendsOn: (seriesId, year) =>
        displayFriends.flatMap((friend) => {
          const entry = friend.season.find(
            (e) =>
              e.seriesId === seriesId &&
              e.year === year &&
              visibleToCrew(e.status)
          );
          return entry ? [{ friend, entry }] : [];
        }),
      sharedWith: (friend) =>
        friend.season.flatMap((fe) => {
          if (!visibleToCrew(fe.status)) return [];
          const mine = state.season.find(
            (e) => e.seriesId === fe.seriesId && e.year === fe.year
          );
          if (!mine) return [];
          const race = resolveRace(fe, friend.customRaces ?? [], dbRaces);
          return race ? [race] : [];
        }),
      loadSample: () =>
        patch((p) => ({
          ...p,
          season: SAMPLE_SEASON.map((e) => ({ ...e })),
          customRaces: [],
        })),
      clearSeason: () => patch((p) => ({ ...p, season: [], customRaces: [] })),
    };
  }, [
    state,
    configured,
    authReady,
    userId,
    email,
    crew,
    crewCode,
    hydrated,
    pendingJoin,
    joinNotice,
    refreshCrew,
    refreshCode,
    redeemInvite,
    dbRaces,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
