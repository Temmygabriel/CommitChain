"use client";
// CommitChain — Profile Screen
// Session 6

import { useEffect, useState } from "react";
import { Screen, Profile, Commitment, getCategoryIcon, formatDeadline } from "../types";

interface ProfileProps {
  playerAddress: string;
  playerName: string;
  profile: Profile | null;
  myCommitments: Commitment[];
  onLoad: () => void;
  onLoadMyCommitments: () => void;
  onSelectCommitment: (c: Commitment) => void;
  onNavigate: (screen: Screen) => void;
  loading: string;
  error: string;
}

function KeyExportBox() {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [privateKey, setPrivateKey] = useState("");

  useEffect(() => {
    // Read directly from localStorage every time revealed changes
    const k = localStorage.getItem("cc_private_key") || "";
    setPrivateKey(k);
  }, [revealed]);

  function copyKey() {
    const k = localStorage.getItem("cc_private_key") || "";
    navigator.clipboard.writeText(k).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div className="section-label">Your Private Key</div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-2)",
          lineHeight: 1.5,
        }}
      >
        Save this to restore your CommitChain identity on another device.
        Never share it with anyone.
      </div>

      {!revealed ? (
        <button
          className="btn-outline"
          onClick={() => setRevealed(true)}
          style={{ fontSize: "13px", padding: "10px 16px" }}
        >
          🔑 Reveal Private Key
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--broken-border)",
              borderRadius: "var(--r)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--broken)",
              wordBreak: "break-all",
              lineHeight: 1.8,
              userSelect: "all",
            }}
          >
            {privateKey || "Key not found — try refreshing"}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn-secondary"
              onClick={copyKey}
              style={{
                flex: 1,
                fontSize: "13px",
                padding: "10px 12px",
                color: copied ? "var(--kept)" : undefined,
                borderColor: copied ? "var(--kept-border)" : undefined,
                background: copied ? "var(--kept-bg)" : undefined,
              }}
            >
              {copied ? "✓ Copied!" : "Copy Key"}
            </button>
            <button
              className="btn-outline"
              onClick={() => setRevealed(false)}
              style={{ flex: 1, fontSize: "13px", padding: "10px 12px" }}
            >
              Hide
            </button>
          </div>
          <div className="info-box info-box--warn" style={{ fontSize: "12px" }}>
            ⚠️ Anyone with this key controls your identity. Store it safely.
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileScreen({
  playerAddress,
  playerName,
  profile,
  myCommitments,
  onLoad,
  onLoadMyCommitments,
  onSelectCommitment,
  onNavigate,
  loading,
  error,
}: ProfileProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onLoad();
    if (myCommitments.length === 0) onLoadMyCommitments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyAddress() {
    navigator.clipboard.writeText(playerAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const isLoading = !!loading;

  // Completion rate
  const completionRate =
    profile && profile.total_resolved > 0
      ? Math.round((profile.kept_count / profile.total_resolved) * 100)
      : null;

  // Recent resolved for mini-history
  const recentResolved = myCommitments
    .filter((c) => c.status === "resolved")
    .slice(0, 6);

  return (
    <div className="fadeIn" style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "80px" }}>

      {/* ── Header ── */}
      <h2 className="screen-title">Profile</h2>

      {/* ── Identity card ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "160px",
            height: "160px",
            background: "radial-gradient(ellipse, rgba(108,99,255,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Avatar initial */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--accent-soft)",
            border: "2px solid var(--accent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            color: "var(--accent)",
          }}
        >
          {playerName ? playerName[0].toUpperCase() : "?"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {playerName || "Anonymous"}
          </div>
          <div
            className="address-chip"
            style={{ cursor: "pointer" }}
            onClick={copyAddress}
          >
            <span className="address-dot" />
            <span className="address-text">{playerAddress}</span>
            <span className="address-copy-btn">
              {copied ? "✓" : "Copy"}
            </span>
          </div>
        </div>

        {/* Completion rate bar */}
        {completionRate !== null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--text-3)",
              }}
            >
              <span>Completion rate</span>
              <span
                style={{
                  color:
                    completionRate >= 70
                      ? "var(--kept)"
                      : completionRate >= 40
                      ? "var(--partial)"
                      : "var(--broken)",
                  fontWeight: 700,
                }}
              >
                {completionRate}%
              </span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${completionRate}%`,
                  background:
                    completionRate >= 70
                      ? "var(--kept)"
                      : completionRate >= 40
                      ? "var(--partial)"
                      : "var(--broken)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Streak ── */}
      {isLoading && !profile ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Loading profile…</span>
        </div>
      ) : profile ? (
        <>
          {/* Streak display */}
          <div className="streak-display">
            <div
              className={`streak-number${profile.current_streak > 0 ? " streak-number--active" : ""}`}
            >
              {profile.current_streak}
            </div>
            <div className="streak-label">Current streak</div>
            {profile.longest_streak > 0 && (
              <div className="streak-sub">
                Best:{" "}
                <strong style={{ color: "var(--text-2)" }}>
                  {profile.longest_streak}
                </strong>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="profile-stats">
            <div className="profile-stat-card">
              <div className="profile-stat-num profile-stat-num--kept">
                {profile.kept_count}
              </div>
              <div className="profile-stat-lbl">Kept</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-num profile-stat-num--partial">
                {profile.partial_count}
              </div>
              <div className="profile-stat-lbl">Partial</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-num profile-stat-num--broken">
                {profile.broken_count}
              </div>
              <div className="profile-stat-lbl">Broken</div>
            </div>
          </div>

          {/* Total */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              fontSize: "13px",
              color: "var(--text-2)",
            }}
          >
            <span>Total commitments</span>
            <strong style={{ color: "var(--text-primary)" }}>
              {profile.total_commitments}
            </strong>
          </div>

          {/* Streak rules */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div className="section-label">How streaks work</div>
            {[
              ["✓", "var(--kept)",    "KEPT adds +1 to your streak"],
              ["✗", "var(--broken)",  "BROKEN resets your streak to 0"],
              ["~", "var(--partial)", "PARTIAL is neutral — streak stays the same"],
            ].map(([icon, color, text]) => (
              <div
                key={String(text)}
                style={{
                  display: "flex",
                  gap: "10px",
                  fontSize: "13px",
                  color: "var(--text-2)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                    color: color as string,
                    minWidth: "16px",
                  }}
                >
                  {icon}
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ── Recent resolved history ── */}
      {recentResolved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="section-label">Recent results</div>
            <button
              className="btn-ghost"
              style={{ fontSize: "12px" }}
              onClick={() => onNavigate("my_commitments")}
            >
              See all →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentResolved.map((c) => {
              const vmap: Record<string, { icon: string; color: string }> = {
                KEPT:    { icon: "✓", color: "var(--kept)"    },
                BROKEN:  { icon: "✗", color: "var(--broken)"  },
                PARTIAL: { icon: "~", color: "var(--partial)" },
              };
              const v = c.verdict ? vmap[c.verdict] : null;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCommitment(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor =
                      "var(--border-active)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.borderColor =
                      "var(--border)")
                  }
                >
                  {v && (
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.4rem",
                        color: v.color,
                        flexShrink: 0,
                        lineHeight: 1,
                        width: "20px",
                        textAlign: "center",
                      }}
                    >
                      {v.icon}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.goal_text}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-3)",
                        marginTop: "2px",
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      <span>{getCategoryIcon(c.category)}</span>
                      <span>{formatDeadline(c.commitment_deadline)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {/* ── Key export ── */}
      <KeyExportBox />
    </div>
  );
}