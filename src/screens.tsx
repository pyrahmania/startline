import { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Brand,
  RaceCard,
  StatusChip,
  YearToggle,
  raceMeta,
} from "./components";
import {
  COUNTRIES,
  DISTANCES,
  STATUSES,
  SURFACES,
  USER,
} from "./data";
import { inviteError } from "./lib/remote";
import { appUrl, initialsFrom, peekJoin, stashJoin } from "./storage";
import {
  MONTHS,
  MONTHS_SHORT,
  anchorMonth,
  countdownLabel,
  daysUntil,
  distanceLabel,
  formatLongDate,
  formatShortDate,
  kmValue,
  parseISO,
  surfaceLabel,
  todayISO,
} from "./format";
import { entryStatusLabel } from "./lib/races";
import { useStore } from "./state";
import type { Distance, RaceView, Status, Surface } from "./types";

export type AddOutcome = {
  key: string;
  already: boolean;
  name: string;
  status: Status;
  date: string;
};

export function AddRaceBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="add-bar">
      <button onClick={onClick}>Add a race</button>
    </div>
  );
}

export function SeasonScreen({
  onRace,
  onAdd,
  onCustom,
  focusKey,
  focusMonth,
}: {
  onRace: (key: string) => void;
  onAdd: () => void;
  onCustom: () => void;
  focusKey?: string | null;
  focusMonth?: number | null;
}) {
  const { year, setYear, units, mySeason, resolve, friendsOn } = useStore();
  const [month, setMonth] = useState<number | "all">(() => anchorMonth(year));
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (typeof focusMonth === "number") setMonth(focusMonth);
  }, [focusMonth, focusKey]);

  useEffect(() => {
    const sel = month === "all" ? "[data-month='all']" : `[data-month='${month}']`;
    scrollerRef.current?.querySelector(sel)?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
  }, [month, year]);

  useEffect(() => {
    if (!focusKey) return;
    const id = window.setTimeout(() => {
      document
        .querySelector(`[data-race-key="${focusKey}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [focusKey, month, visible.length]);

  function changeYear(next: number) {
    setYear(next);
    setMonth(anchorMonth(next));
  }

  return (
    <>
    <div className="screen">
      <Brand year={year} onYear={changeYear} />
      <div className="month-scroller" ref={scrollerRef}>
        <button
          data-month="all"
          className={`month-chip ${month === "all" ? "on" : ""}`}
          onClick={() => setMonth("all")}
        >
          All
        </button>
        {MONTHS_SHORT.map((label, i) => (
          <button
            key={label}
            data-month={i}
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
        <EmptySeason onFind={onAdd} onCustom={onCustom} onRace={onRace} />
      ) : visible.length === 0 ? (
        <p className="muted">
          No races in {typeof month === "number" ? MONTHS[month] : "this view"}.
        </p>
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
                  flash={focusKey === entry.key}
                  friends={friendsOn(race.seriesId, race.year).map((x) => x.friend)}
                  onClick={() => onRace(entry.key)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
      <AddRaceBar onClick={onAdd} />
    </>
  );
}

function EmptySeason({
  onFind,
  onCustom,
  onRace,
}: {
  onFind: () => void;
  onCustom: () => void;
  onRace: (key: string) => void;
}) {
  const { units, mySeason, friendsOn, races } = useStore();
  const taken = new Set(mySeason.map((e) => e.seriesId));
  const preferred = [
    "york-10k",
    "leeds-half",
    "yorkshire-marathon",
    "knavesmire-5k",
    "great-north-run",
  ];
  const catalog = races;
  const suggested = preferred
    .map((id) => catalog.find((r) => r.seriesId === id))
    .filter((r): r is RaceView => !!r && !taken.has(r.seriesId))
    .slice(0, 3);

  return (
    <div className="empty">
      <div className="bib" />
      <h2>BOARD EMPTY</h2>
      <p>Find the next race you’re targeting this year.</p>
      <button className="primary" onClick={onFind}>
        Find a race
      </button>
      <button className="text-link" onClick={onCustom}>
        Can’t see it? Add it yourself
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

export function DiscoverScreen({
  onRace,
  onAdd,
  onCustom,
}: {
  onRace: (key: string) => void;
  onAdd: () => void;
  onCustom: (query?: string) => void;
}) {
  const { year, setYear, units, friendsOn, myEntry, exampleCrew, races, allRaces } =
    useStore();
  const [q, setQ] = useState("");
  const [distance, setDistance] = useState<Distance | "all">("all");
  const [month, setMonth] = useState<number | "all">("all");
  const [country, setCountry] = useState<string>("GB");
  const [surface, setSurface] = useState<Surface | "all">("all");
  const [nearYork, setNearYork] = useState(false);

  const needle = q.trim().toLowerCase();
  const pool = needle ? allRaces : races;
  const rows = pool.filter((r) => {
    const text = `${r.name} ${r.city} ${r.region ?? ""}`.toLowerCase();
    if (needle && !text.includes(needle)) return false;
    if (distance !== "all") {
      const tags = r.distanceTags ?? [r.distance];
      if (!tags.includes(distance)) return false;
    }
    if (month !== "all" && parseISO(r.date).getMonth() !== month) return false;
    if (country !== "all" && r.country !== country) return false;
    if (surface !== "all" && r.surface !== surface) return false;
    if (nearYork && !r.nearYork) return false;
    return true;
  });

  return (
    <>
    <div className="screen">
      <div className="brand-row">
        <h1 className="wordmark">
          <span>CATALOG</span>
          DISCOVER
        </h1>
        <YearToggle year={year} onYear={setYear} />
      </div>
      {exampleCrew ? (
        <p className="notice">
          Friend counts are from the sample crew, not real testers.
        </p>
      ) : null}
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
        <div className="filter-row">
          <button
            className={`pill ${nearYork ? "on" : ""}`}
            onClick={() => setNearYork((v) => !v)}
          >
            Near York
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        q.trim() ? (
          <button className="empty-search" onClick={() => onCustom(q.trim())}>
            No matches. Add “{q.trim()}” as a custom race.
          </button>
        ) : (
          <p className="muted">No races match those filters.</p>
        )
      ) : (
        <>
          {rows.map((race) => {
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
                    {race.city}
                    {race.nearYork ? " · near York" : ""}
                    {" · "}
                    {race.distanceLabels && race.distanceLabels.length > 0
                      ? race.distanceLabels.join(" / ")
                      : distanceLabel(race.distance, units)}
                    {" · "}
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
                  <div className="when">
                    {formatShortDate(race.date).toUpperCase()} {race.year}
                  </div>
                  {mine ? <StatusChip status={mine.status} /> : null}
                </div>
              </button>
            );
          })}
          <button className="text-link listed" onClick={() => onCustom(q.trim() || undefined)}>
            Add a race that isn’t listed
          </button>
        </>
      )}
    </div>
      <AddRaceBar onClick={onAdd} />
    </>
  );
}

function isDismissedShare(err: unknown): boolean {
  return (
    (err instanceof DOMException || err instanceof Error) &&
    (err.name === "AbortError" || err.name === "NotAllowedError")
  );
}

export function FriendsScreen({
  onFriend,
  onToast,
}: {
  onFriend: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const {
    year,
    resolve,
    crew,
    exampleCrew,
    createInvite,
    signedIn,
    refreshCrew,
    redeemInvite,
  } = useStore();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    void refreshCrew().catch(() => {});
  }, [signedIn, refreshCrew]);

  async function invite() {
    setBusy(true);
    try {
      if (!signedIn) {
        const url = appUrl();
        const text = `I'm pinning my ${year} races on startline365. Add yours: ${url}`;
        if (navigator.share) {
          await navigator.share({ title: "startline365", text, url });
          return;
        }
        await navigator.clipboard.writeText(text);
        onToast("Link copied");
        return;
      }
      const url = await createInvite();
      setInviteUrl(url);
    } catch (err) {
      if (isDismissedShare(err)) return;
      onToast(err instanceof Error ? err.message : "Couldn’t create invite");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(
        `Join my startline365 crew: ${inviteUrl}`
      );
      onToast("Invite copied");
    } catch {
      onToast("Couldn’t copy — select the link");
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    const text = `Join my startline365 crew: ${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "startline365", text, url: inviteUrl });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast("Invite copied");
    } catch (err) {
      if (isDismissedShare(err)) return;
      onToast("Couldn’t share — copy the link instead");
    }
  }

  async function joinWithCode() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    try {
      const name = await redeemInvite(trimmed);
      setCode("");
      onToast(name ? `You’re crew with ${name}` : "You’re in the crew");
    } catch (err) {
      onToast(inviteError(err));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="screen">
      <div className="brand-row">
        <h1 className="wordmark">
          <span>{exampleCrew ? "EXAMPLE CREW" : "YOUR CREW"}</span>
          FRIENDS
        </h1>
      </div>
      {exampleCrew ? (
        <p className="notice">
          These five are sample runners so you can see overlap. Sign-in enables a
          real crew.
        </p>
      ) : (
        <p className="notice">
          Send a link. When they sign in with it, their season shows here.
        </p>
      )}
      <button
        className="primary full"
        style={{ marginBottom: 14 }}
        onClick={invite}
        disabled={busy}
      >
        {busy ? "Creating…" : "Invite friends"}
      </button>
      {inviteUrl ? (
        <div className="invite-box">
          <p className="invite-kicker">ONE PERSON · 14 DAYS</p>
          <p className="invite-url">{inviteUrl}</p>
          <div className="btn-row">
            <button className="ghost" onClick={copyInvite}>
              Copy link
            </button>
            <button className="ghost" onClick={shareInvite}>
              Share
            </button>
          </div>
        </div>
      ) : null}
      {!exampleCrew && crew.length === 0 ? (
        <div className="empty">
          <div className="bib" />
          <h2>NO CREW YET</h2>
          <p>
            Invite a runner. After they open the link and sign in, tap them to
            see their races.
          </p>
        </div>
      ) : (
        crew.map((friend) => {
          const season = friend.season.filter((e) => e.year === year);
          const races = season
            .map((e) => resolve(e, friend.customRaces))
            .filter((r): r is NonNullable<typeof r> => Boolean(r))
            .sort((a, b) => a.date.localeCompare(b.date));
          const upcoming = races.filter((r) => daysUntil(r.date) >= 0);
          const shown = (upcoming.length ? upcoming : races).slice(0, 2);
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
                  {friend.city || "—"}
                  {shown.length
                    ? ` · ${shown.map((r) => r.name).join(" · ")}`
                    : " · no races this season"}
                </p>
              </div>
              <div className="count">
                {season.length}
                <span>{season.length === 1 ? "race" : "races"}</span>
              </div>
            </button>
          );
        })
      )}
      {signedIn && !exampleCrew ? (
        showCode ? (
          <div className="invite-box" style={{ marginTop: 8 }}>
            <label className="field">
              Invite code
              <input
                className="field-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste a code"
                autoCapitalize="off"
                autoCorrect="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinWithCode();
                }}
              />
            </label>
            <button
              className="ghost full"
              style={{ marginTop: 10 }}
              onClick={joinWithCode}
              disabled={joining || !code.trim()}
            >
              {joining ? "Joining…" : "Join crew"}
            </button>
          </div>
        ) : (
          <button className="text-link" onClick={() => setShowCode(true)}>
            Have an invite code?
          </button>
        )
      ) : null}
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
  const { year, units, resolve, sharedWith, friendsOn, crew, refreshCrew } =
    useStore();
  useEffect(() => {
    void refreshCrew().catch(() => {});
  }, [refreshCrew]);
  const friend = crew.find((f) => f.id === friendId);
  if (!friend) {
    return (
      <div className="screen detail">
        <button className="back" data-nav="back" onClick={onBack}>
          ← Crew
        </button>
        <p className="muted">That runner isn’t in your crew.</p>
      </div>
    );
  }
  const shared = sharedWith(friend).filter((r) => r.year === year);
  const items = friend.season
    .filter((e) => e.year === year)
    .map((e) => ({ entry: e, race: resolve(e, friend.customRaces) }))
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
      {friend.id.length < 20 ? (
        <p className="notice">Sample runner — not a real tester.</p>
      ) : null}
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
  onAdded,
}: {
  raceKey: string;
  onBack: () => void;
  onFriend: (id: string) => void;
  onToast: (msg: string) => void;
  onAdded: (outcome: AddOutcome) => void;
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
        {entryStatusLabel(race.entryStatus) ? (
          <p className="muted" style={{ marginTop: 8 }}>
            {entryStatusLabel(race.entryStatus)}
          </p>
        ) : null}
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
            onClick={() => {
              try {
                const existing = myEntry(race.key);
                if (existing) {
                  onAdded({
                    key: existing.key,
                    already: true,
                    name: race.name,
                    status: existing.status,
                    date: race.date,
                  });
                  return;
                }
                const key = addCatalog(race.seriesId, race.year, pick);
                onAdded({
                  key,
                  already: false,
                  name: race.name,
                  status: pick,
                  date: race.date,
                });
              } catch {
                onToast("Couldn't add that race");
              }
            }}
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
  onFail,
  initialMode = "search",
  initialQuery = "",
}: {
  onClose: () => void;
  onAdded: (outcome: AddOutcome) => void;
  onFail: (message: string) => void;
  initialMode?: "search" | "custom";
  initialQuery?: string;
}) {
  const { units, addCatalog, addCustom, myEntry, city: userCity, allRaces } =
    useStore();
  const [path, setPath] = useState<"search" | "custom">(initialMode);
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<Status>("thinking");
  const [name, setName] = useState(initialQuery);
  const [date, setDate] = useState(todayISO());
  const [city, setCity] = useState(userCity);
  const [distance, setDistance] = useState<Distance>("10k");

  const results = allRaces.filter((r) => {
    const text = `${r.name} ${r.city} ${r.region ?? ""}`.toLowerCase();
    return !q || text.includes(q.toLowerCase());
  });

  function addExisting(race: RaceView) {
    try {
      const existing = myEntry(race.key);
      if (existing) {
        onAdded({
          key: existing.key,
          already: true,
          name: race.name,
          status: existing.status,
          date: race.date,
        });
        return;
      }
      const key = addCatalog(race.seriesId, race.year, status);
      onAdded({ key, already: false, name: race.name, status, date: race.date });
    } catch {
      onFail("Couldn't add that race");
    }
  }

  function create() {
    if (!name.trim() || !date || !city.trim()) {
      onFail("Name, date and city are required");
      return;
    }
    try {
      const key = addCustom(
        {
          name: name.trim(),
          date,
          city: city.trim(),
          country: "GB",
          distance,
          surface: "road",
        },
        status
      );
      onAdded({ key, already: false, name: name.trim(), status, date });
    } catch {
      onFail("Couldn't add that race");
    }
  }

  function openCustom(fromQuery?: string) {
    if (fromQuery) setName(fromQuery);
    setPath("custom");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        <h2>ADD A RACE</h2>
        {path === "search" ? (
          <>
            <input
              className="search"
              placeholder="Search the catalog"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
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
            {results.length === 0 ? (
              q.trim() ? (
                <button className="empty-search" onClick={() => openCustom(q.trim())}>
                  No matches. Add “{q.trim()}” as a custom race.
                </button>
              ) : (
                <p className="muted">Type a race or city to search.</p>
              )
            ) : (
              results.map((race) => (
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
                  <div className="when">
                    {formatShortDate(race.date).toUpperCase()} {race.year}
                  </div>
                </button>
              ))
            )}
            <button className="text-link listed" onClick={() => openCustom(q.trim() || undefined)}>
              Add a race that isn’t listed
            </button>
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
                autoFocus
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
            <label className="field span">
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
            <label className="field span">Status</label>
            <div className="filter-row span" style={{ marginBottom: 8 }}>
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
            <button className="primary span" onClick={create}>
              Add to season
            </button>
            <button className="text-link span" onClick={() => setPath("search")}>
              Back to search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthScreen() {
  const { signIn, hasPendingJoin } = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState(() => peekJoin() ?? "");

  async function submit() {
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    try {
      if (inviteCode.trim()) stashJoin(inviteCode);
      await signIn(addr);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen onboard">
      <h1 className="wordmark">
        <span>BETA</span>
        STARTLINE365
      </h1>
      {sent ? (
        <p className="lede">
          Check {email} for a sign-in link. Open it on this phone.
          {hasPendingJoin || inviteCode.trim()
            ? " You’ll join the crew after you open it."
            : ""}
        </p>
      ) : (
        <>
          <p className="lede">
            {hasPendingJoin || inviteCode.trim()
              ? "You were invited to a crew. Sign in with email — no password — to join them and see their races."
              : "Sign in with email. We’ll send a link — no password."}
          </p>
          <label className="field">
            Email
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </label>
          <label className="field">
            Invite code (optional)
            <input
              className="field-input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="If you were sent a code"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>
          {error ? <p className="notice">{error}</p> : null}
          <button
            className="primary full"
            style={{ marginTop: 18 }}
            onClick={submit}
            disabled={busy || !email.trim()}
          >
            {busy ? "Sending…" : "Email me a link"}
          </button>
        </>
      )}
    </div>
  );
}

export function OnboardScreen() {
  const { setProfile, joinNotice } = useStore();
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
        <span>BETA</span>
        STARTLINE365
      </h1>
      <p className="lede">
        {joinNotice?.kind === "joined"
          ? `You’re in ${joinNotice.name}’s crew. Add your name so they recognise you, then pin your races.`
          : "Pin the races you’re targeting this year. Invite your crew after you’ve added the first one."}
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
    signedIn,
    email,
    signOut,
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
            {city || "—"} · {year} · Beta
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
        <div className="kicker">STARTLINE365 · {year}</div>
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
          <span>beta</span>
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
        <h2>Account</h2>
        {signedIn ? (
          <>
            <p className="notice">{email}</p>
            <button
              className="ghost full"
              onClick={() => signOut().catch(() => onToast("Couldn’t sign out"))}
            >
              Sign out
            </button>
          </>
        ) : (
          <p className="notice">
            Local mode — add Supabase keys to enable sign-in and crew.
          </p>
        )}
        <a
          className="ghost full"
          style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 8 }}
          href="mailto:scottrichards4@gmail.com?subject=startline365%20beta"
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

export function Toast({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="toast">
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function DebugFooter({
  action,
  raceId,
  month,
}: {
  action: string;
  raceId: string;
  month: string;
}) {
  if (typeof localStorage === "undefined") return null;
  if (localStorage.getItem("startlineDebug") !== "1") return null;
  return (
    <div className="debug-footer">
      {action} · {raceId || "—"} · {month}
    </div>
  );
}
