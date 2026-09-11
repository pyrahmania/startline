import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { loadState, saveState } from "./storage";
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

type Store = {
  name: string;
  city: string;
  year: number;
  units: Units;
  season: SeasonEntry[];
  customRaces: CustomRace[];
  setProfile: (name: string, city: string) => void;
  setYear: (year: number) => void;
  setUnits: (units: Units) => void;
  mySeason: SeasonEntry[];
  resolve: (entry: SeasonEntry) => RaceView | null;
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
  const [state, setState] = useState<Persisted>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo<Store>(() => {
    const mySeason = state.season
      .filter((e) => e.year === state.year)
      .slice()
      .sort((a, b) => {
        const ra = resolveRace(a, state.customRaces);
        const rb = resolveRace(b, state.customRaces);
        return (ra?.date ?? "").localeCompare(rb?.date ?? "");
      });

    const resolve = (entry: SeasonEntry) => resolveRace(entry, state.customRaces);

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
      name: state.name,
      city: state.city,
      year: state.year,
      units: state.units,
      season: state.season,
      customRaces: state.customRaces,
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
            season: [
              ...p.season,
              { key, seriesId, year, status, notes: "" },
            ],
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
            {
              key: id,
              seriesId: id,
              year,
              status,
              notes: "",
              customId: id,
            },
          ],
        }));
        return id;
      },
      setStatus: (key, status) =>
        patch((p) => ({
          ...p,
          season: p.season.map((e) =>
            e.key === key
              ? {
                  ...e,
                  status,
                  finishTime: status === "done" ? e.finishTime : undefined,
                }
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
        FRIENDS.flatMap((friend) => {
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
          const race = resolveRace(fe, state.customRaces);
          return race ? [race] : [];
        }),
      loadSample: () =>
        patch((p) => ({
          ...p,
          season: SAMPLE_SEASON.map((e) => ({ ...e })),
          customRaces: [],
        })),
      clearSeason: () =>
        patch((p) => ({ ...p, season: [], customRaces: [] })),
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
