"use client";
// CommitChain — Desktop Sidebar
import { Screen } from "../types";

interface SidebarProps {
  activeScreen: Screen;
  playerAddress: string;
  playerName: string;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: "landing",        icon: "⌂",  label: "Home"    },
  { screen: "my_commitments", icon: "🔗", label: "Mine"    },
  { screen: "explore",        icon: "◎",  label: "Explore" },
  { screen: "profile",        icon: "◈",  label: "Profile" },
];

export default function Sidebar({ activeScreen, playerAddress, playerName, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🔗</div>
        <span className="sidebar-brand-name">CommitChain</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ screen, icon, label }) => (
          <button
            key={screen}
            className={`sidebar-item${activeScreen === screen ? " sidebar-item--active" : ""}`}
            onClick={() => onNavigate(screen)}
          >
            <span className="sidebar-item-icon">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Footer — address */}
      <div className="sidebar-footer">
        <div className="sidebar-address-label">
          <span className="sidebar-dot" />
          {playerName || "Anonymous"}
        </div>
        <div className="sidebar-address-val">
          {playerAddress
            ? `${playerAddress.slice(0, 6)}…${playerAddress.slice(-4)}`
            : "Generating…"}
        </div>
        <button
          className="sidebar-item"
          style={{ marginTop: "4px" }}
          onClick={() => onNavigate("import_key")}
        >
          <span className="sidebar-item-icon">↗</span>
          <span style={{ fontSize: "13px" }}>Import key</span>
        </button>
      </div>
    </aside>
  );
}
