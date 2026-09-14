export type Distance =
  | "5k"
  | "10k"
  | "10mile"
  | "half"
  | "marathon"
  | "ultra"
  | "other";

export type Surface = "road" | "trail";
export type Status = "thinking" | "signed_up" | "training" | "done";
export type Units = "km" | "mi";
export type Tab = "season" | "discover" | "friends" | "me";

export type AvatarSpec = {
  initials: string;
  bg: string;
  fg: string;
  shape: "circle" | "squircle" | "hex" | "diamond" | "shield";
  pattern: "solid" | "split" | "ring" | "bars" | "dot";
};

export type CatalogRace = {
  seriesId: string;
  name: string;
  city: string;
  country: string;
  /** ISO dates keyed by season year. */
  dates: Partial<Record<number, string>>;
  distance: Distance;
  surface: Surface;
};

export type CustomRace = {
  id: string;
  name: string;
  date: string;
  city: string;
  country: string;
  distance: Distance;
  surface: Surface;
};

export type SeasonEntry = {
  key: string;
  seriesId: string;
  year: number;
  status: Status;
  notes: string;
  finishTime?: string;
  customId?: string;
};

export type RaceView = {
  key: string;
  seriesId: string;
  year: number;
  name: string;
  date: string;
  city: string;
  country: string;
  distance: Distance;
  surface: Surface;
  custom: boolean;
  customId?: string;
};

export type Friend = {
  id: string;
  name: string;
  city: string;
  avatar: AvatarSpec;
  season: SeasonEntry[];
};

export type Persisted = {
  version: 2;
  name: string;
  city: string;
  year: number;
  units: Units;
  season: SeasonEntry[];
  customRaces: CustomRace[];
};

export type Screen =
  | { name: "tabs" }
  | { name: "race"; raceKey: string }
  | { name: "friend"; friendId: string };
