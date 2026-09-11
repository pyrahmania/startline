import { useMemo, useState } from "react";
import {
  Avatar,
  Brand,
  PlusIcon,
  RaceCard,
  StatusChip,
  YearToggle,
  raceMeta,
} from "./components";
import {
  COUNTRIES,
  DISTANCES,
  FRIENDS,
  STATUSES,
  SURFACES,
  USER,
} from "./data";
import { appUrl, initialsFrom } from "./storage";
import {
  MONTHS,
  MONTHS_SHORT,
  catalogForYear,
  countdownLabel,
  daysUntil,
  distanceLabel,
  formatLongDate,
  formatShortDate,
  kmValue,
  parseISO,
  surfaceLabel,
} from "./format";
import { useStore } from "./state";
import type { Distance, RaceView, Status, Surface } from "./types";

export function SeasonScreen({
  onRace,
  onAdd,
}: {
  onRace: (key: string) => void;
  onAdd: () => void;
}) {
  const { year, setYear, units, mySeason, resolve, friendsOn } = useStore();
  const [month, setMonth] = useState<number | "all">("all");

  const races = mySeason
    .map((e) => {
      const race = resolve(e);
      return race ? { entry: e, race } : null;
    })
    .filter(Boolean) as { entry: (typeof mySeason)[0]; race: RaceView }[];

  const monthSet = new Set(races.map((r) => parseISO(r.race.date).getMonth()));
  const visible =
    month === "all"
      ? races
      : races.filter((r) => parseISO(r.race.date).getMonth() === month);

  const grouped: { month: number; items: typeof visible }[] = [];
  for (const item of visible) {
    const m = parseISO(item.race.date).getMonth();
    const last = grouped[grouped.length - 1];
    if (!last || last.month !== m) grouped.push({ month: m, items: [item] });
    else last.items.push(item);
  }

  const upcoming = races
    .filter(
      (r) =>
        (r.entry.status === "signed_up" || r.entry.status === "training") &&
        daysUntil(r.race.date) >= 0
    )
    .sort((a, b) => a.race.date.localeCompare(b.race.date))[0];

  return (
    <>
    <div className="screen">
      <Brand year={year} onYear={setYear} />
      <div className="month-scroller">
        <button
          className={`month-chip ${month === "all" ? "on" : ""}`}
          onClick={() => setMonth("all")}
        >
          All
        </button>
        {MONTHS_SHORT.map((label, i) => (
          <button
            key={label}
            className={`month-chip ${month === i ? "on" : ""}`}
            onClick={() => setMonth(i)}
          >
            {label}
            {monthSet.has(i) ? <i className="dot" /> : null}
          </button>
        ))}
      </div>

      {upcoming ? (
        <div className="countdown">
          <div className="kicker">Next locked in</div>
          <div className="big">{countdownLabel(upcoming.race.date)}</div>
          <div className="sub">
            {upcoming.race.name} · {formatLongDate(upcoming.race.date)}
          </div>
        </div>
      ) : null}

      {races.length === 0 ? (
        <EmptySeason onAdd={onAdd} onRace={onRace} />
      ) : visible.length === 0 ? (
        <p className="muted">No races in {MONTHS[month as number]}.</p>
      ) : (
        grouped.map((g) => (
          <section key={g.month}>
            <div className="month-label">{MONTHS[g.month].toUpperCase()}</div>
            <div className="card-list">
              {g.items.map(({ entry, race }) => (
                <RaceCard
                  key={entry.key}
                  race={race}
                  status={entry.status}
                  units={units}
                  finishTime={entry.finishTime}
                  friends={friendsOn(race.seriesId, race.year).map((x) => x.friend)}
                  onClick={() => onRace(entry.key)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
      {races.length > 0 ? (
        <div className="add-bar">
          <button onClick={onAdd}>
            <PlusIcon /> Add race
          </button>
        </div>
      ) : null}
    </>
  );
}

function EmptySeason({
  onAdd,
  onRace,
}: {
  onAdd: () => void;
  onRace: (key: string) => void;
}) {
  const { year, units, mySeason, friendsOn } = useStore();
  const taken = new Set(mySeason.map((e) => e.seriesId));
  const preferred = [
    "york-10k",
    "leeds-half",
    "yorkshire-marathon",
    "knavesmire-5k",
    "great-north-run",
  ];
  const catalog = catalogForYear(year);
  const suggested = preferred
    .map((id) => catalog.find((r) => r.seriesId === id))
    .filter((r): r is RaceView => !!r && !taken.has(r.seriesId))
    .slice(0, 3);

  return (
    <div className="empty">
      <div className="bib" />
      <h2>BOARD EMPTY</h2>
      <p>Add the next race you’re targeting this year.</p>
      <button className="primary" onClick={onAdd}>
        Add your first race
      </button>
      <div className="suggest">
        <h3>Suggested to start</h3>
        <div className="card-list">
          {suggested.map((race) => (
            <RaceCard
              key={race.key}
              race={race}
              units={units}
              friends={friendsOn(race.seriesId, race.year).map((x) => x.friend)}
              onClick={() => onRace(race.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DiscoverScreen({ onRace }: { onRace: (key: string) => void }) {
  const { year, units, friendsOn, myEntry } = useStore();
  const [q, setQ] = useState("");
  const [distance, setDistance] = useState<Distance | "all">("all");
  const [month, setMonth] = useState<number | "all">("all");
  const [country, setCountry] = useState<string>("GB");
  const [surface, setSurface] = useState<Surface | "all">("all");

  const rows = catalogForYear(year).filter((r) => {
    const text = `${r.name} ${r.city}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (distance !== "all" && r.distance !== distance) return false;
    if (month !== "all" && parseISO(r.date).getMonth() !== month) return false;
    if (country !== "all" && r.country !== country) return false;
    if (surface !== "all" && r.surface !== surface) return false;
    return true;
  });

  return (
    <div className="screen">
      <div className="brand-row">
        <h1 className="wordmark">
          <span>CATALOG</span>
          DISCOVER
        </h1>
      </div>
      <p className="notice">
        Friend counts are from the sample crew, not real testers.
      </p>
      <input
        className="search"
        placeholder="Search races or cities"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="filters">
        <div className="filter-row">
          <button
            className={`pill ${distance === "all" ? "on" : ""}`}
            onClick={() => setDistance("all")}
          >
            Any distance
          </button>
          {DISTANCES.map((d) => (
            <button
              key={d.id}
              className={`pill ${distance === d.id ? "on" : ""}`}
              onClick={() => setDistance(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <button
            className={`pill ${month === "all" ? "on" : ""}`}
            onClick={() => setMonth("all")}
          >
            Any month
          </button>
          {MONTHS_SHORT.map((label, i) => (
            <button
              key={label}
              className={`pill ${month === i ? "on" : ""}`}
              onClick={() => setMonth(i)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <button
            className={`pill ${country === "all" ? "on" : ""}`}
            onClick={() => setCountry("all")}
          >
            Any country
          </button>
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              className={`pill ${country === c.id ? "on" : ""}`}
              onClick={() => setCountry(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <button
            className={`pill ${surface === "all" ? "on" : ""}`}
            onClick={() => setSurface("all")}
          >
            Any surface
          </button>
          {SURFACES.map((s) => (
            <button
              key={s.id}
              className={`pill ${surface === s.id ? "on" : ""}`}
              onClick={() => setSurface(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No races match those filters.</p>
      ) : (
        rows.map((race) => {
          const pals = friendsOn(race.seriesId, race.year);
          const mine = myEntry(race.key);
          return (
            <button
              key={race.key}
              className="discover-row"
              onClick={() => onRace(race.key)}
            >
              <div>
                <p className="name">{race.name}</p>
                <p className="meta">
                  {race.city} · {distanceLabel(race.distance, units)} ·{" "}
                  {surfaceLabel(race.surface)}
                  {pals.length ? (
                    <>
                      {" · "}
                      <span className="friend-count">
                        {pals.length} friend{pals.length === 1 ? "" : "s"}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="side">
                <div className="when">{formatShortDate(race.date).toUpperCase()}</div>
                {mine ? <StatusChip status={mine.status} /> : null}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

export function FriendsScreen({
  onFriend,
  onToast,
}: {
  onFriend: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const { year, resolve } = useStore();

  async function invite() {
    const url = appUrl();
    const text = `I'm pinning my ${year} races on Startline. Add yours: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Startline", text, url });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast("Invite copied");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        onToast("Invite copied");
      } catch {
        onToast(text);
      }
    }
  }

  return (
    <div className="screen">
      <div className="brand-row">
        <h1 className="wordmark">
          <span>EXAMPLE CREW</span>
          FRIENDS
        </h1>
      </div>
      <p className="notice">
        These five are sample runners so you can see overlap. Real crew comes
        later. Invite still sends a link to the alpha.
      </p>
      <button className="ghost full" style={{ marginBottom: 14 }} onClick={invite}>
        Invite friends
      </button>
      {FRIENDS.map((friend) => {
        const season = friend.season.filter((e) => e.year === year);
        const next = season
          .map((e) => ({ e, race: resolve(e) }))
          .filter((x) => x.race)
          .sort((a, b) => a.race!.date.localeCompare(b.race!.date))
          .find((x) => daysUntil(x.race!.date) >= 0) ??
          season
            .map((e) => ({ e, race: resolve(e) }))
            .filter((x) => x.race)
            .sort((a, b) => a.race!.date.localeCompare(b.race!.date))[0];
        return (
          <button
            key={friend.id}
            className="friend-row"
            onClick={() => onFriend(friend.id)}
          >
            <Avatar spec={friend.avatar} />
            <div>
              <h3>{friend.name}</h3>
              <p>
                {friend.city}
                {next?.race ? ` · next ${next.race.name}` : " · no races this season"}
              </p>
            </div>
            <div className="count">
              {season.length}
              <span>{season.length === 1 ? "race" : "races"}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function FriendSeasonScreen({
  friendId,
  onBack,
  onRace,
}: {
  friendId: string;
  onBack: () => void;
  onRace: (key: string) => void;
}) {
  const { year, units, resolve, sharedWith, friendsOn } = useStore();
  const friend = FRIENDS.find((f) => f.id === friendId);
  if (!friend) return null;
  const shared = sharedWith(friend).filter((r) => r.year === year);
  const items = friend.season
    .filter((e) => e.year === year)
    .map((e) => ({ entry: e, race: resolve(e) }))
    .filter((x) => x.race)
    .sort((a, b) => a.race!.date.localeCompare(b.race!.date)) as {
    entry: (typeof friend.season)[0];
    race: RaceView;
  }[];

  const grouped: { month: number; items: typeof items }[] = [];
  for (const item of items) {
    const m = parseISO(item.race.date).getMonth();
    const last = grouped[grouped.length - 1];
    if (!last || last.month !== m) grouped.push({ month: m, items: [item] });
    else last.items.push(item);
  }

  return (
    <div className="screen detail">
      <button className="back" data-nav="back" onClick={onBack}>
        ← Crew
      </button>
      <div className="me-head">
        <Avatar spec={friend.avatar} size="lg" />
        <div>
          <h1>{friend.name}</h1>
          <p>
            {friend.city} · {year} season
          </p>
        </div>
      </div>
      <p className="notice">Sample runner — not a real tester.</p>
      {shared.length > 0 ? (
        <div className="banner">
          You’re both in: {shared.map((r) => r.name).join(" · ")}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          No overlapping races this year.
        </p>
      )}
      {items.length === 0 ? (
        <div className="empty">
          <div className="bib" />
          <h2>EMPTY BOARD</h2>
          <p>{friend.name} hasn’t pinned a race this season.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.month}>
            <div className="month-label">{MONTHS[g.month].toUpperCase()}</div>
            <div className="card-list">
              {g.items.map(({ entry, race }) => (
                <RaceCard
                  key={entry.key}
                  race={race}
                  status={entry.status}
                  units={units}
                  friends={friendsOn(race.seriesId, race.year)
                    .map((x) => x.friend)
                    .filter((f) => f.id !== friend.id)}
                  onClick={() => onRace(race.key)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export function RaceDetailScreen({
  raceKey,
  onBack,
  onFriend,
  onToast,
}: {
  raceKey: string;
  onBack: () => void;
  onFriend: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const {
    units,
    raceByKey,
    myEntry,
    addCatalog,
    setStatus,
    setNotes,
    setFinishTime,
    remove,
    friendsOn,
  } = useStore();
  const [pick, setPick] = useState<Status>("thinking");
  const race = raceByKey(raceKey);
  if (!race) {
    return (
      <div className="screen detail">
        <button className="back" data-nav="back" onClick={onBack}>
          ← Back
        </button>
        <p>Race not found.</p>
      </div>
    );
  }
  const mine = myEntry(race.key);
  const pals = friendsOn(race.seriesId, race.year);
  const date = parseISO(race.date);

  async function share() {
    const text = `I'm targeting ${race!.name} on ${formatLongDate(
      race!.date
    )}. ${appUrl()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: race!.name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast("Race copied");
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        onToast("Race copied");
      } catch {
        onToast(text);
      }
    }
  }

  return (
    <div className="screen detail">
      <button className="back" data-nav="back" onClick={onBack}>
        ← Back
      </button>
      <div className="detail-hero">
        <p className="date">{String(date.getDate()).padStart(2, "0")}</p>
        <p className="mon">
          {MONTHS[date.getMonth()].toUpperCase()} {date.getFullYear()}
        </p>
        <h1>{race.name}</h1>
        <p className="meta">{raceMeta(race, units)}</p>
      </div>

      {mine ? (
        <>
          <div className="status-grid">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                className={`${s.id} ${mine.status === s.id ? "on" : ""}`}
                onClick={() => setStatus(mine.key, s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="field" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            value={mine.notes}
            onChange={(e) => setNotes(mine.key, e.target.value)}
            placeholder="Kit, hotel, target pace…"
          />
          {mine.status === "done" ? (
            <>
              <label className="field" htmlFor="finish">
                Finish time
              </label>
              <input
                id="finish"
                className="field-input"
                value={mine.finishTime ?? ""}
                onChange={(e) => setFinishTime(mine.key, e.target.value)}
                placeholder="1:38:12"
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <label className="field">Add with status</label>
          <div className="status-grid">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                className={`${s.id} ${pick === s.id ? "on" : ""}`}
                onClick={() => setPick(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="primary full"
            onClick={() => addCatalog(race.seriesId, race.year, pick)}
          >
            Add to season
          </button>
        </>
      )}

      <div className="going">
        <h2>Friends going</h2>
        {pals.length === 0 ? (
          <p className="muted">
            None of your friends have this on their season yet
          </p>
        ) : (
          pals.map(({ friend, entry }) => (
            <div className="going-row" key={friend.id}>
              <button className="plain" onClick={() => onFriend(friend.id)}>
                <Avatar spec={friend.avatar} />
                <div>
                  <strong>{friend.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {friend.city}
                  </div>
                </div>
              </button>
              <StatusChip status={entry.status} />
            </div>
          ))
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 18 }}>
        <button className="ghost" onClick={share}>
          Share race
        </button>
        {mine ? (
          <button
            className="danger"
            onClick={() => {
              remove(mine.key);
              onBack();
            }}
          >
            Remove from season
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AddRaceSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (key: string) => void;
}) {
  const { year, units, addCatalog, addCustom, myEntry } = useStore();
  const [path, setPath] = useState<"search" | "custom">("search");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("thinking");
  const [name, setName] = useState("");
  const [date, setDate] = useState(`${year}-10-01`);
  const [city, setCity] = useState("");
  const [distance, setDistance] = useState<Distance>("10k");
  const [surface, setSurface] = useState<Surface>("road");

  const results = catalogForYear(year).filter((r) => {
    const text = `${r.name} ${r.city}`.toLowerCase();
    return !q || text.includes(q.toLowerCase());
  });

  function addExisting(race: RaceView) {
    const existing = myEntry(race.key);
    if (existing) {
      onAdded(existing.key);
      return;
    }
    onAdded(addCatalog(race.seriesId, race.year, status));
  }

  function create() {
    if (!name.trim() || !date || !city.trim()) return;
    const key = addCustom(
      {
        name: name.trim(),
        date,
        city: city.trim(),
        country: "GB",
        distance,
        surface,
      },
      status
    );
    onAdded(key);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        <h2>ADD RACE</h2>
        <div className="path-toggle">
          <button
            className={path === "search" ? "primary" : "ghost"}
            onClick={() => setPath("search")}
          >
            Search catalog
          </button>
          <button
            className={path === "custom" ? "primary" : "ghost"}
            onClick={() => setPath("custom")}
          >
            Create custom
          </button>
        </div>
        <label className="field">Status</label>
        <div className="filter-row" style={{ marginBottom: 12 }}>
          {STATUSES.map((s) => (
            <button
              key={s.id}
              className={`pill ${status === s.id ? "on" : ""}`}
              onClick={() => setStatus(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {path === "search" ? (
          <>
            <input
              className="search"
              placeholder="York 10K, Manchester Half…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {results.map((race) => (
              <button
                key={race.key}
                className="discover-row"
                onClick={() => addExisting(race)}
              >
                <div>
                  <p className="name">{race.name}</p>
                  <p className="meta">
                    {race.city} · {distanceLabel(race.distance, units)} ·{" "}
                    {surfaceLabel(race.surface)}
                  </p>
                </div>
                <div className="when">{formatShortDate(race.date).toUpperCase()}</div>
              </button>
            ))}
          </>
        ) : (
          <div className="form-grid">
            <label className="field span">
              Name
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Club 10K"
              />
            </label>
            <label className="field">
              Date
              <input
                className="field-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              City
              <input
                className="field-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="York"
              />
            </label>
            <label className="field">
              Distance
              <select
                className="field-input"
                value={distance}
                onChange={(e) => setDistance(e.target.value as Distance)}
              >
                {DISTANCES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Surface
              <select
                className="field-input"
                value={surface}
                onChange={(e) => setSurface(e.target.value as Surface)}
              >
                {SURFACES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary span" onClick={create}>
              Add to season
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OnboardScreen() {
  const { setProfile } = useStore();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  function continueOnboard() {
    const n = name.trim();
    if (!n) return;
    setProfile(n, city.trim() || "York");
  }

  return (
    <div className="screen onboard">
      <h1 className="wordmark">
        <span>ALPHA</span>
        STARTLINE
      </h1>
      <p className="lede">
        Pin the races you’re targeting this year. Your season stays on this
        phone — friends in the app are sample data.
      </p>
      <label className="field">
        Name
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex"
          autoFocus
        />
      </label>
      <label className="field">
        City
        <input
          className="field-input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="York"
        />
      </label>
      <button
        className="primary full"
        style={{ marginTop: 18 }}
        onClick={continueOnboard}
        disabled={!name.trim()}
      >
        Start my season
      </button>
    </div>
  );
}

export function MeScreen({ onToast }: { onToast: (msg: string) => void }) {
  const {
    name,
    city,
    setProfile,
    year,
    setYear,
    units,
    setUnits,
    mySeason,
    resolve,
    friendsOn,
    loadSample,
    clearSeason,
  } = useStore();
  const items = mySeason
    .map((e) => ({ entry: e, race: resolve(e) }))
    .filter((x) => x.race) as { entry: (typeof mySeason)[0]; race: RaceView }[];

  const stats = useMemo(() => {
    const planned = items.length;
    const signed = items.filter((i) => i.entry.status === "signed_up").length;
    const done = items.filter((i) => i.entry.status === "done").length;
    const longest = items.reduce(
      (best, i) => Math.max(best, kmValue(i.race.distance)),
      0
    );
    const withFriends = items.filter(
      (i) => friendsOn(i.race.seriesId, i.race.year).length > 0
    ).length;
    return { planned, signed, done, longest, withFriends };
  }, [items, friendsOn]);

  const longestLabel =
    stats.longest === 0
      ? "—"
      : stats.longest >= 50
        ? "Ultra"
        : stats.longest >= 42
          ? units === "km"
            ? "42.2 km"
            : "26.2 mi"
          : stats.longest >= 21
            ? units === "km"
              ? "21.1 km"
              : "13.1 mi"
            : units === "km"
              ? `${stats.longest} km`
              : `${(stats.longest * 0.621).toFixed(1)} mi`;

  const avatar = { ...USER.avatar, initials: initialsFrom(name) };
  const [editName, setEditName] = useState(name);
  const [editCity, setEditCity] = useState(city);

  async function copySeason() {
    const lines = items.map(
      (i) => `${formatShortDate(i.race.date)}  ${i.race.name}`
    );
    const text = `${name} · ${year} season\n${lines.join("\n")}\n${appUrl()}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast("Season copied");
    } catch {
      onToast("Couldn’t copy");
    }
  }

  return (
    <div className="screen">
      <div className="me-head">
        <Avatar spec={avatar} size="lg" />
        <div>
          <h1>{name}</h1>
          <p>
            {city || "—"} · {year} · Alpha
          </p>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <b>{stats.planned}</b>
          <span>Planned</span>
        </div>
        <div className="stat">
          <b>{stats.signed}</b>
          <span>Signed up</span>
        </div>
        <div className="stat">
          <b>{stats.done}</b>
          <span>Done</span>
        </div>
        <div className="stat">
          <b>{longestLabel}</b>
          <span>Longest</span>
        </div>
      </div>

      <p className="section-title">Share season</p>
      <div className="share-card">
        <div className="holes">
          <i />
          <i />
        </div>
        <div className="kicker">STARTLINE · {year}</div>
        <h3>
          {name.toUpperCase()} · {(city || "—").toUpperCase()}
        </h3>
        <ol>
          {items.length === 0 ? (
            <li>
              <em className="muted">No races pinned</em>
            </li>
          ) : (
            items.map((i) => (
              <li key={i.entry.key}>
                {i.race.name}
                <span>{formatShortDate(i.race.date)}</span>
              </li>
            ))
          )}
        </ol>
        <div className="foot">
          <span>
            <b>{stats.withFriends}</b> races with friends
          </span>
          <span>alpha</span>
        </div>
      </div>
      <button className="ghost full" onClick={copySeason}>
        Copy season summary
      </button>

      <div className="settings">
        <h2>Profile</h2>
        <label className="field">
          Name
          <input
            className="field-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              if (editName.trim()) setProfile(editName, editCity);
            }}
          />
        </label>
        <label className="field">
          City
          <input
            className="field-input"
            value={editCity}
            onChange={(e) => setEditCity(e.target.value)}
            onBlur={() => setProfile(editName, editCity)}
          />
        </label>
        <h2>Settings</h2>
        <label className="field">Units</label>
        <div className="year-toggle" style={{ width: "fit-content" }}>
          <button className={units === "km" ? "on" : ""} onClick={() => setUnits("km")}>
            km
          </button>
          <button className={units === "mi" ? "on" : ""} onClick={() => setUnits("mi")}>
            miles
          </button>
        </div>
        <label className="field">Target year</label>
        <YearToggle year={year} onYear={setYear} />
        <h2>Alpha</h2>
        <p className="notice">
          Your season stays on this phone. Testers cannot see each other yet.
        </p>
        <a
          className="ghost full"
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          href="mailto:scottrichards4@gmail.com?subject=Startline%20alpha"
        >
          Send feedback
        </a>
        <button
          className="danger full"
          style={{ marginTop: 8 }}
          onClick={() => {
            clearSeason();
            onToast("Season cleared");
          }}
        >
          Clear my season
        </button>
        <button
          className="sample-link"
          onClick={() => {
            loadSample();
            onToast("Sample season loaded");
          }}
        >
          Load sample season
        </button>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}
