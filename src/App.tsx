import { useEffect, useState } from "react";
import { TabBar } from "./components";
import { MONTHS, isUpcoming, parseISO, statusLabel } from "./format";
import {
  AddOutcome,
  AddRaceSheet,
  DebugFooter,
  DiscoverScreen,
  FriendSeasonScreen,
  FriendsScreen,
  AuthScreen,
  MeScreen,
  OnboardScreen,
  RaceDetailScreen,
  SeasonScreen,
  Toast,
} from "./screens";
import { StoreProvider, useStore } from "./state";
import type { Screen, Tab } from "./types";

type ToastInfo = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type AddSheet = {
  mode: "search" | "custom";
  query?: string;
};

type Focus = {
  key: string;
  month: number;
};

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const {
    name,
    configured,
    authReady,
    hydrated,
    signedIn,
    joinNotice,
    clearJoinNotice,
    mySeason,
    resolve,
    crew,
    exampleCrew,
  } = useStore();
  const [invitePromptKey, setInvitePromptKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("season");
  const [stack, setStack] = useState<Screen[]>([{ name: "tabs" }]);
  const screen = stack[stack.length - 1];
  const [addSheet, setAddSheet] = useState<AddSheet | null>(null);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [debug, setDebug] = useState({ action: "idle", raceId: "", month: "—" });

  function push(next: Screen) {
    setStack((s) => [...s, next]);
  }
  function back() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function showToast(info: string | ToastInfo) {
    setToast(typeof info === "string" ? { message: info } : info);
  }

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.actionLabel ? 4000 : 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!focus) return;
    const id = window.setTimeout(() => setFocus(null), 1500);
    return () => window.clearTimeout(id);
  }, [focus]);

  useEffect(() => {
    if (!hydrated || !signedIn || !name.trim() || !joinNotice) return;
    if (joinNotice.kind === "joined") {
      if (joinNotice.raceKey) {
        setTab("season");
        setStack([{ name: "tabs" }, { name: "race", raceKey: joinNotice.raceKey }]);
      } else {
        setTab("friends");
        setStack([{ name: "tabs" }]);
      }
      showToast(`You’re crew with ${joinNotice.name}`);
    } else {
      showToast(joinNotice.message);
    }
    clearJoinNotice();
  }, [hydrated, signedIn, name, joinNotice, clearJoinNotice]);

  const hadUpcoming = mySeason.some((e) => {
    const race = resolve(e);
    return race ? isUpcoming(race.date) : false;
  });

  function landOnSeason(outcome: AddOutcome) {
    const month = parseISO(outcome.date).getMonth();
    const monthName = MONTHS[month] ?? "—";
    setAddSheet(null);
    setDebug({
      action: outcome.already ? "already" : "added",
      raceId: outcome.key,
      month: monthName,
    });
    const firstUpcoming =
      !outcome.already &&
      isUpcoming(outcome.date) &&
      !hadUpcoming &&
      crew.length === 0 &&
      !exampleCrew;
    if (firstUpcoming) {
      setInvitePromptKey(outcome.key);
      setTab("season");
      setStack([{ name: "tabs" }, { name: "race", raceKey: outcome.key }]);
      setFocus({ key: outcome.key, month });
      showToast(`Added · ${outcome.name}`);
      return;
    }
    setTab("season");
    setStack([{ name: "tabs" }]);
    setFocus({ key: outcome.key, month });
    showToast({
      message: outcome.already
        ? `Already in your season · ${outcome.name}`
        : `Added to your season · ${outcome.name} · ${statusLabel(outcome.status)}`,
      actionLabel: "View",
      onAction: () => setFocus({ key: outcome.key, month }),
    });
  }

  const onTabs = screen.name === "tabs";

  if (!authReady || (configured && signedIn && !hydrated)) {
    return (
      <div className="app-shell">
        <div className="phone">
          <div className="screen onboard">
            <h1 className="wordmark">
              <span>BETA</span>
              STARTLINE365
            </h1>
            <p className="lede">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (configured && !signedIn) {
    return (
      <div className="app-shell">
        <div className="phone">
          <AuthScreen />
        </div>
      </div>
    );
  }

  if (!name.trim()) {
    return (
      <div className="app-shell">
        <div className="phone">
          <OnboardScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="phone">
        {screen.name === "tabs" && tab === "season" ? (
          <SeasonScreen
            onRace={(raceKey) => push({ name: "race", raceKey })}
            onAdd={() => setAddSheet({ mode: "search" })}
            onCustom={() => setAddSheet({ mode: "custom" })}
            focusKey={focus?.key}
            focusMonth={focus?.month}
          />
        ) : null}
        {screen.name === "tabs" && tab === "discover" ? (
          <DiscoverScreen
            onRace={(raceKey) => push({ name: "race", raceKey })}
            onAdd={() => setAddSheet({ mode: "search" })}
            onCustom={(query) => setAddSheet({ mode: "custom", query })}
          />
        ) : null}
        {screen.name === "tabs" && tab === "friends" ? (
          <FriendsScreen
            onFriend={(friendId) => push({ name: "friend", friendId })}
            onToast={showToast}
          />
        ) : null}
        {screen.name === "tabs" && tab === "me" ? (
          <MeScreen onToast={showToast} />
        ) : null}
        {screen.name === "race" ? (
          <RaceDetailScreen
            raceKey={screen.raceKey}
            onBack={back}
            onFriend={(friendId) => push({ name: "friend", friendId })}
            onToast={showToast}
            onAdded={landOnSeason}
            promptInvite={invitePromptKey === screen.raceKey}
            onSkipPrompt={() => setInvitePromptKey(null)}
          />
        ) : null}
        {screen.name === "friend" ? (
          <FriendSeasonScreen
            friendId={screen.friendId}
            onBack={back}
            onRace={(raceKey) => push({ name: "race", raceKey })}
          />
        ) : null}

        {onTabs ? (
          <TabBar
            tab={tab}
            onTab={(next) => {
              setTab(next);
              setStack([{ name: "tabs" }]);
            }}
          />
        ) : null}

        {addSheet ? (
          <AddRaceSheet
            key={`${addSheet.mode}:${addSheet.query ?? ""}`}
            initialMode={addSheet.mode}
            initialQuery={addSheet.query ?? ""}
            onClose={() => setAddSheet(null)}
            onAdded={landOnSeason}
            onFail={showToast}
          />
        ) : null}

        {toast ? (
          <Toast
            message={toast.message}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
          />
        ) : null}

        <DebugFooter action={debug.action} raceId={debug.raceId} month={debug.month} />
      </div>
    </div>
  );
}
