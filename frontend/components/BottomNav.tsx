"use client";
// CommitChain — Bottom Navigation
// Session 4

import { Screen } from "../types";

interface BottomNavProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: "landing",        icon: "⌂",  label: "Home"    },
  { screen: "my_commitments", icon: "🔗", label: "Mine"    },
  { screen: "explore",        icon: "◎",  label: "Explore" },
  { screen: "profile",        icon: "◈",  label: "Profile" },
];

export default function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ screen, icon, label }) => (
        <button
          key={screen}
          className={`nav-item${activeScreen === screen ? " nav-item--active" : ""}`}
          onClick={() => onNavigate(screen)}
        >
          <span className="nav-item-icon">{icon}</span>
          <span className="nav-item-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
