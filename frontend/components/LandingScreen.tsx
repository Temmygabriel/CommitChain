"use client";
// CommitChain — Landing Screen
// Session 4

import { useEffect, useState } from "react";
import {
  Screen,
  Commitment,
  Profile,
  getCategoryIcon,
  formatDeadline,
  isExpired,
  daysUntil,
} from "../types";

interface LandingProps {
  playerAddress: string;
  playerName: string;
  profile: Profile | null;
  recentCommitments: Commitment[];
  onSetName: (name: string) => void;
  onNavigate: (screen: Screen) => void;
  onLoadRecent: () => void;
  onLoadProfile: () => void;
  onSelectCommitment: (c: Commitment) => void;
  onCheckExpired: (id: string) => void;
  loading: string;
  error: string;
}

function DeadlinePill({ commitment }: { commitment: Commitment }) {
  if (commitment.status === "resolved") return null;
  const days = daysUntil(commitment.commitment_deadline);
  const cls =
    days < 0
      ? "deadline-pill deadline-pill--urgent"
      : days <= 2
      ? "deadline-pill deadline-pill--soon"
      : "deadline-pill deadline-pill--ok";
  const label =
    days < 0
      ? "Overdue"
      : days === 0
      ? "Due today"
      : days === 1
      ? "Due tomorrow"
      : `${days}d left`;
  return <span className={cls}>⏱ {label}</span>;
}

function CommitmentBadge({ commitment }: { commitment: Commitment }) {
  if (commitment.status === "committed") {
    return <span className="badge badge--committed">Pending</span>;
  }
  if (commitment.status === "evaluating") {
    return <span className="badge badge--evaluating">Evaluating</span>;
  }
  if (commitment.verdict === "KEPT") {
    return <span className="badge badge--resolved-kept">✓ Kept</span>;
  }
  if (commitment.verdict === "BROKEN") {
    return <span className="badge badge--resolved-broken">✗ Broken</span>;
  }
  if (commitment.verdict === "PARTIAL") {
    return <span className="badge badge--resolved-partial">~ Partial</span>;
  }
  return null;
}

export default function LandingScreen({
  playerAddress,
  playerName,
  profile,
  recentCommitments,
  onSetName,
  onNavigate,
  onLoadRecent,
  onLoadProfile,
  onSelectCommitment,
  onCheckExpired,
  loading,
  error,
}: LandingProps) {
  const [nameInput, setNameInput]   = useState(playerName);
  const [nameLocked, setNameLocked] = useState(!!playerName);
  const [copied, setCopied]         = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    if (playerName) {
      setNameInput(playerName);
      setNameLocked(true);
    }
  }, [playerName]);

  useEffect(() => {
    setFeedLoading(true);
    Promise.all([onLoadRecent(), onLoadProfile ? onLoadProfile() : Promise.resolve()])
      .finally(() => setFeedLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lockName() {
    if (nameInput.trim()) {
      onSetName(nameInput.trim());
      setNameLocked(true);
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(playerAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const hasName   = !!nameInput.trim();
  const isLoading = !!loading;

  return (
    <div className="fadeIn" style={{ paddingBottom: "80px" }}>

      {/* ── Hero ── */}
      <div className="hero">
        <div className="hero-eyebrow">GenLayer · On-chain accountability</div>
        <h1 className="hero-title">
          Your word,<br />
          <span className="accent">on-chain.</span><br />
          Forever.
        </h1>
        <p className="hero-subtitle">
          Lock what you commit to before you're tempted to change it.
          AI judges whether you kept your word. Your record is permanent.
        </p>

        {/* Streak teaser */}
        {profile && profile.total_commitments > 0 && (
          <div
            style={{
              display: "flex",
              gap: "20px",
              alignItems: "center",
              padding: "14px 18px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "2.4rem",
                  color: profile.current_streak > 0 ? "var(--accent)" : "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {profile.current_streak}
              </span>
              <span className="section-label">Current streak</span>
            </div>
            <div
              style={{
                width: "1px",
                height: "40px",
                background: "var(--border)",
              }}
            />
            <div style={{ display: "flex", flex: 1, gap: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--kept)" }}>
                  {profile.kept_count}
                </div>
                <div className="section-label">Kept</div>
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--broken)" }}>
                  {profile.broken_count}
                </div>
                <div className="section-label">Broken</div>
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--partial)" }}>
                  {profile.partial_count}
                </div>
                <div className="section-label">Partial</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Identity ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="section-label">Your identity</div>

          <div className="address-chip">
            <span className="address-dot" />
            <span className="address-text">
              {playerAddress || "Generating address…"}
            </span>
            {playerAddress && (
              <button className="address-copy-btn" onClick={copyAddress}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            )}
          </div>

          <div className="name-row">
            <input
              type="text"
              placeholder="Your display name…"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setNameLocked(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && lockName()}
              disabled={nameLocked}
              maxLength={30}
            />
            {nameLocked ? (
              <button
                className="name-set-btn name-set-btn--confirmed"
                onClick={() => setNameLocked(false)}
              >
                ✏️ Edit
              </button>
            ) : (
              <button
                className="name-set-btn"
                onClick={lockName}
                disabled={!hasName}
              >
                Set →
              </button>
            )}
          </div>

          {nameLocked && (
            <div className="name-confirmed">
              ✓ Showing as <strong style={{ marginLeft: "4px" }}>{nameInput}</strong>
            </div>
          )}
        </div>

        {/* ── Primary CTA ── */}
        <button
          className="btn-primary"
          onClick={() => onNavigate("create_commitment")}
          disabled={isLoading || !hasName}
          style={{ fontSize: "16px", padding: "16px 24px" }}
        >
          + Make a Commitment
        </button>

        {/* ── Import key link ── */}
        <div style={{ textAlign: "center" }}>
          <button
            className="btn-ghost"
            style={{ fontSize: "13px", color: "var(--text-muted)" }}
            onClick={() => onNavigate("import_key")}
          >
            Using a different device? Import your key →
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {/* ── Recent feed ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="section-label">Recent commitments</div>
            <button
              className="btn-ghost"
              style={{ fontSize: "12px" }}
              onClick={() => onNavigate("explore")}
            >
              See all →
            </button>
          </div>

          {feedLoading ? (
            <div className="loading-state">
              <span className="spinner" />
              <span>Loading feed…</span>
            </div>
          ) : recentCommitments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔗</div>
              <div className="empty-state-title">No commitments yet</div>
              <div className="empty-state-sub">
                Be the first to lock one on-chain.
              </div>
            </div>
          ) : (
            <div className="chain-list">
              {recentCommitments.slice(0, 5).map((c, i) => {
                const nodeClass =
                  c.status === "resolved"
                    ? `chain-node--${c.verdict?.toLowerCase() ?? "committed"}`
                    : `chain-node--${c.status}`;
                const lineClass =
                  c.verdict
                    ? `chain-line--${c.verdict.toLowerCase()}`
                    : "";
                const isLast = i === Math.min(recentCommitments.length, 5) - 1;
                const showExpireBtn =
                  c.status === "committed" && isExpired(c.proof_deadline);

                return (
                  <div key={c.id} className="chain-item">
                    <div className="chain-left">
                      <div className={`chain-node ${nodeClass}`} />
                      {!isLast && (
                        <div className={`chain-line ${lineClass}`} />
                      )}
                    </div>
                    <div className="chain-content">
                      <div
                        className={`commitment-card commitment-card--${
                          c.status === "resolved"
                            ? c.verdict?.toLowerCase() ?? "committed"
                            : c.status
                        }`}
                        onClick={() => onSelectCommitment(c)}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <div className="commitment-card-goal">{c.goal_text}</div>
                          <CommitmentBadge commitment={c} />
                        </div>

                        <div className="commitment-card-meta">
                          <span className="category-chip">
                            {getCategoryIcon(c.category)} {c.category}
                          </span>
                          <DeadlinePill commitment={c} />
                        </div>

                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          by{" "}
                          <strong style={{ color: "var(--text-secondary)" }}>
                            {c.owner_name}
                          </strong>
                          {" · "}
                          <span className="id-badge">{c.id}</span>
                        </div>

                        {/* AI reasoning preview on resolved */}
                        {c.status === "resolved" && c.reasoning && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "10px 12px",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: "var(--radius)",
                              fontSize: "13px",
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                              lineHeight: 1.5,
                              borderTop: "1px solid var(--border-subtle)",
                            }}
                          >
                            "{c.reasoning}"
                          </div>
                        )}
                      </div>

                      {/* Expire button — anyone can trigger it */}
                      {showExpireBtn && (
                        <button
                          className="btn-outline"
                          style={{
                            marginTop: "8px",
                            fontSize: "13px",
                            padding: "8px 16px",
                            color: "var(--broken)",
                            borderColor: "var(--broken-border)",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckExpired(c.id);
                          }}
                        >
                          Mark as expired →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div className="section-label">How it works</div>
          {[
            ["🔒", "Lock it", "Write your goal and success criteria before the deadline. Stored immutably on GenLayer."],
            ["📋", "Prove it", "When your deadline arrives, submit evidence of what happened."],
            ["⚖️", "AI judges", "An impartial AI compares your original criteria against your proof. KEPT, BROKEN, or PARTIAL."],
            ["∞", "Forever", "The verdict is permanent. No one — not even you — can edit it afterwards."],
          ].map(([icon, title, desc]) => (
            <div
              key={String(title)}
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.4rem",
                  color: "var(--accent)",
                  lineHeight: 1,
                  paddingTop: "2px",
                  flexShrink: 0,
                  minWidth: "24px",
                }}
              >
                {icon}
              </span>
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: "2px",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
