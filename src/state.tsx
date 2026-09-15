import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FRIENDS, SAMPLE_SEASON } from "./data";
import {
  catalogForYear,
  catalogKey,
  raceFromCatalog,
  raceFromCustom,
  resolveRace,
} from "./format";
import {
  acceptInviteCode,
  createInviteCode,
  fetchCrew,
  fetchMine,
  pushMine,
} from "./lib/remote";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import { appUrl, loadState, saveState } from "./storage";
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

const JOIN_KEY = "startline.join";

function peekJoin(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get("join");
    if (q) {
      sessionStorage.setItem(JOIN_KEY, q);
      return q;
    }
    return sessionStorage.getItem(JOIN_KEY);
  } catch {
    return null;
  }
}

function clearJoin(): void {
  try {
    sessionStorage.removeItem(JOIN_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has("join")) {
      url.searchParams.delete("join");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    /* ignore */
  }
}

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
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  createInvite: () => Promise<string>;
  setProfile: (name: string, city: string) => void;
  setYear: (year: number) => void;
  setUnits: (units: Units) => void;
  mySeason: SeasonEntry[];
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
  const skipPush = useRef(true);

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
        } catch {
          /* invalid/expired — ignore */
        }
        clearJoin();
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
    const displayFriends = crew.length ? crew : FRIENDS;
    const mySeason = state.season
      .filter((e) => e.year === state.year)
      .slice()
      .sort((a, b) => {
        const ra = resolveRace(a, state.customRaces);
        const rb = resolveRace(b, state.customRaces);
        return (ra?.date ?? "").localeCompare(rb?.date ?? "");
      });

    const resolve = (entry: SeasonEntry, customs = state.customRaces) =>
      resolveRace(entry, customs);

    const raceByKey = (key: string): RaceView | null => {
      const mine = state.season.find((e) => e.key === key);
      if (mine) return resolve(mine);
      const custom = state.customRaces.find((r) => r.id === key);
      if (custom) return raceFromCustom(custom);
      const [seriesId, yearStr] = key.split(":");
      const year = Number(yearStr);
      if (seriesId && year) return raceFromCatalog(seriesId, year);
      return catalogForYear(state.year).find((r) => r.key === key) ?? null;
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
      exampleCrew: crew.length === 0,
      signIn: async (addr: string) => {
        const sb = getSupabase();
        if (!sb) throw new Error("Sign-in is not configured");
        peekJoin();
        const { error } = await sb.auth.signInWithOtp({
          email: addr.trim(),
          options: { emailRedirectTo: `${appUrl()}/` },
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
        return `${appUrl()}/?join=${code}`;
      },
      setProfile: (name, city) =>
        patch((p) => ({ ...p, name: name.trim(), city: city.trim() })),
      setYear: (year) => patch((p) => ({ ...p, year })),
      setUnits: (units) => patch((p) => ({ ...p, units })),
      mySeason,
      resolve,
      raceByKey,
      myEntry,
      addCatalog: (seriesId, year, status) => {
        const key = catalogKey(seriesId, year);
        patch((p) => {
          if (p.season.some((e) => e.key === key)) return { ...p, year };
          return {
            ...p,
            year,
            season: [...p.season, { key, seriesId, year, status, notes: "" }],
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
          const race = resolveRace(fe, friend.customRaces ?? []);
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
  }, [state, configured, authReady, userId, email, crew, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
