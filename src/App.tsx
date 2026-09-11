import { useEffect, useState } from "react";
import { TabBar } from "./components";
import {
  AddRaceSheet,
  DiscoverScreen,
  FriendSeasonScreen,
  FriendsScreen,
  MeScreen,
  OnboardScreen,
  RaceDetailScreen,
  SeasonScreen,
  Toast,
} from "./screens";
import { StoreProvider, useStore } from "./state";
import type { Screen, Tab } from "./types";

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { name } = useStore();
  const [tab, setTab] = useState<Tab>("season");
  const [stack, setStack] = useState<Screen[]>([{ name: "tabs" }]);
  const screen = stack[stack.length - 1];
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function push(next: Screen) {
    setStack((s) => [...s, next]);
  }
  function back() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const onTabs = screen.name === "tabs";

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
            onAdd={() => setAddOpen(true)}
          />
        ) : null}
        {screen.name === "tabs" && tab === "discover" ? (
          <DiscoverScreen
            onRace={(raceKey) => push({ name: "race", raceKey })}
          />
        ) : null}
        {screen.name === "tabs" && tab === "friends" ? (
          <FriendsScreen
            onFriend={(friendId) => push({ name: "friend", friendId })}
            onToast={setToast}
          />
        ) : null}
        {screen.name === "tabs" && tab === "me" ? (
          <MeScreen onToast={setToast} />
        ) : null}
        {screen.name === "race" ? (
          <RaceDetailScreen
            raceKey={screen.raceKey}
            onBack={back}
            onFriend={(friendId) => push({ name: "friend", friendId })}
            onToast={setToast}
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

        {addOpen ? (
          <AddRaceSheet
            onClose={() => setAddOpen(false)}
            onAdded={(raceKey) => {
              setAddOpen(false);
              push({ name: "race", raceKey });
            }}
          />
        ) : null}

        {toast ? <Toast message={toast} /> : null}
      </div>
    </div>
  );
}
