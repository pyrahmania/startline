import type { ReactNode } from "react";
import { FRIENDS, USER } from "./data";
import {
  countryLabel,
  distanceLabel,
  formatDay,
  formatMonth,
  surfaceLabel,
  statusLabel,
} from "./format";
import type { AvatarSpec, Friend, RaceView, Status, Tab, Units } from "./types";

export function Avatar({
  spec,
  size = "md",
}: {
  spec: AvatarSpec;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={`avatar ${spec.shape} ${spec.pattern} ${size === "lg" ? "lg" : ""} ${
        size === "sm" ? "sm" : ""
      }`}
      style={{ background: spec.bg, color: spec.fg }}
      aria-hidden
    >
      {spec.initials}
    </div>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip ${status}`}>{statusLabel(status)}</span>;
}

export function RaceCard({
  race,
  status,
  units,
  friends,
  finishTime,
  onClick,
}: {
  race: RaceView;
  status?: Status;
  units: Units;
  friends?: Friend[];
  finishTime?: string;
  onClick: () => void;
}) {
  return (
    <button className="race-card" onClick={onClick}>
      <div className="date-block">
        <div className="d">{formatDay(race.date)}</div>
        <div className="m">{formatMonth(race.date)}</div>
      </div>
      <div>
        <p className="name">{race.name}</p>
        <p className="meta">
          {race.city} · {distanceLabel(race.distance, units)} · {surfaceLabel(race.surface)}
          {finishTime ? ` · ${finishTime}` : ""}
        </p>
      </div>
      <div className="side">
        {status ? <StatusChip status={status} /> : null}
        {friends && friends.length > 0 ? (
          <div className="friend-stack">
            {friends.slice(0, 3).map((f) => (
              <Avatar key={f.id} spec={f.avatar} size="sm" />
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "season", label: "Season", icon: <FlagIcon /> },
    { id: "discover", label: "Discover", icon: <CompassIcon /> },
    { id: "friends", label: "Friends", icon: <CrewIcon /> },
    { id: "me", label: "Me", icon: <MeIcon /> },
  ];
  return (
    <nav className="tabs">
      {items.map((item) => (
        <button
          key={item.id}
          data-tab={item.id}
          className={tab === item.id ? "on" : ""}
          onClick={() => onTab(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function YearToggle({
  year,
  onYear,
}: {
  year: number;
  onYear: (y: number) => void;
}) {
  return (
    <div className="year-toggle" role="tablist" aria-label="Season year">
      {[2026, 2027].map((y) => (
        <button key={y} className={year === y ? "on" : ""} onClick={() => onYear(y)}>
          {y}
        </button>
      ))}
    </div>
  );
}

export function Brand({ year, onYear }: { year: number; onYear: (y: number) => void }) {
  return (
    <div className="brand-row">
      <h1 className="wordmark">
        <span>MY SEASON</span>
        STARTLINE
      </h1>
      <YearToggle year={year} onYear={onYear} />
    </div>
  );
}

export function avatarFor(id: string): AvatarSpec {
  if (id === "me") return USER.avatar;
  return FRIENDS.find((f) => f.id === id)?.avatar ?? USER.avatar;
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 21V4m0 0h9l-1.5 3.5L14 11H5" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="m14.8 9.2-1.2 4.4-4.4 1.2 1.2-4.4 4.4-1.2Z" />
    </svg>
  );
}
function CrewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="3" />
      <circle cx="16" cy="10" r="2.4" />
      <path d="M4 18c.6-2.4 2.6-3.8 5-3.8s4.4 1.4 5 3.8" />
      <path d="M14 18c.3-1.5 1.4-2.6 3-2.6 1.7 0 2.8 1 3.2 2.6" />
    </svg>
  );
}
function MeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3 3.2-4.6 6.5-4.6s5.7 1.6 6.5 4.6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 1v12M1 7h12" />
    </svg>
  );
}

export function raceMeta(race: RaceView, units: Units): string {
  return `${race.city} · ${countryLabel(race.country)} · ${distanceLabel(
    race.distance,
    units
  )} · ${surfaceLabel(race.surface)}`;
}
