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
  raceFromCatalog,
  raceFromCustom,
  resolveRace,
} from "./format";
import { mergeCatalog } from "./lib/races";
import {
  acceptInviteCode,
  createInviteCode,
  fetchCrew,
  fetchMine,
  fetchRaces,
  inviteError,
  pushMine,
} from "./lib/remote";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import {
  appUrl,
  clearJoin,
  inviteLink,
  loadState,
  peekJoin,
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
  | { kind: "joined"; name: string }
  | { kind: "error"; message: string };

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
  hasPendingJoin: boolean;
  joinNotice: JoinNotice | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  createInvite: () => Promise<string>;
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
  const [hydrated, setHydrated] = useState(!configured);
  const [joinNotice, setJoinNotice] = useState<JoinNotice | null>(null);
  const [pendingJoin, setPendingJoin] = useState(() => Boolean(peekJoin()));
  const [dbRaces, setDbRaces] = useState<RaceView[]>([]);
  const skipPush = useRef(true);
  const userIdRef = useRef(userId);
  const crewRef = useRef(crew);
  userIdRef.current = userId;
  crewRef.current = crew;

  const refreshCrew = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    const list = await fetchCrew(id);
    setCrew(list);
  }, []);

  const redeemInvite = useCallback(async (raw: string) => {
    const id = userIdRef.current;
    if (!id) throw new Error("Sign in first");
    const code = raw.trim();
    if (!code) throw new Error("Enter an invite code");
    await acceptInviteCode(code);
    clearJoin();
    setPendingJoin(false);
    const prev = crewRef.current;
    const list = await fetchCrew(id);
    setCrew(list);
    const added = list.find((f) => !prev.some((p) => p.id === f.id));
    return added?.name ?? list[0]?.name ?? "";
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
      setHydrated(true);
      return;
    }
    let cancelled = false;
    skipPush.current = true;
    (async () => {
      const remote = await fetchMine(userId);
      const local = loadState();
      const shouldMigrate =
        !remote.name &&
        !remote.season.length &&
        (Boolean(local.name) || local.season.length > 0);
      const next = shouldMigrate ? { ...local, version: 2 as const } : remote;
      if (shouldMigrate) await pushMine(userId, next);
      const join = peekJoin();
      if (join) {
        try {
          await acceptInviteCode(join);
          clearJoin();
          setPendingJoin(false);
          const crewList = await fetchCrew(userId);
          const pal = crewList.find((f) => f.id !== userId) ?? crewList[0];
          setJoinNotice({
            kind: "joined",
            name: pal?.name?.trim() || "your crew",
          });
          if (cancelled) return;
          setState(next);
          setCrew(crewList);
          setHydrated(true);
          skipPush.current = false;
          return;
        } catch (err) {
          const message = inviteError(err);
          const own = message.toLowerCase().includes("own invite");
          const used = message.toLowerCase().includes("already used");
          const expired = message.toLowerCase().includes("expired");
          const missing = message.toLowerCase().includes("not found");
          if (own || used || expired || missing) {
            clearJoin();
            setPendingJoin(false);
            if (!own && !used) setJoinNotice({ kind: "error", message });
            else if (own) setJoinNotice({ kind: "error", message });
          }
        }
      }
      const crewList = await fetchCrew(userId);
      if (cancelled) return;
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
    const t = window.setTimeout(() => {
      pushMine(userId, state).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, userId, hydrated]);

  const value = useMemo<Store>(() => {
    const displayFriends = configured ? crew : FRIENDS;
    const races = mergeCatalog(state.year, dbRaces);
    const allRaces = [2026, 2027].flatMap((y) => mergeCatalog(y, dbRaces));

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
      if (seriesId && year) return raceFromCatalog(seriesId, year);
      return races.find((r) => r.key === key) ?? null;
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
      hasPendingJoin: pendingJoin,
      joinNotice,
      signIn: async (addr: string) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Sign-in is not configured");
        const join = peekJoin();
        if (join) setPendingJoin(true);
        const redirect = join
          ? `${appUrl()}/?join=${encodeURIComponent(join)}`
          : `${appUrl()}/`;
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
      },
      createInvite: async () => {
        const code = await createInviteCode();
        return inviteLink(code);
      },
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
            (e) => e.seriesId === seriesId && e.year === year
          );
          return entry ? [{ friend, entry }] : [];
        }),
      sharedWith: (friend) =>
        friend.season.flatMap((fe) => {
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
    hydrated,
    pendingJoin,
    joinNotice,
    refreshCrew,
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
