"use client";
// CommitChain — Explore Screen
// Session 6

import { useEffect, useState } from "react";
import {
  Commitment,
  Category,
  CATEGORIES,
  getCategoryIcon,
  getCategoryLabel,
  formatDeadline,
  daysUntil,
  isExpired,
} from "../types";

interface ExploreProps {
  recentCommitments: Commitment[];
  onLoadRecent: () => void;
  onLoadByCategory: (category: string) => void;
  onSelectCommitment: (c: Commitment) => void;
  onCheckExpired: (id: string) => void;
  loading: string;
  error: string;
}

type ViewFilter = "all" | Category;

function CommitmentBadge({ c }: { c: Commitment }) {
  if (c.status === "evaluating")
    return <span className="badge badge--evaluating">Evaluating</span>;
  if (c.status === "committed")
    return <span className="badge badge--committed">Pending</span>;
  if (c.verdict === "KEPT")
    return <span className="badge badge--resolved-kept">✓ Kept</span>;
  if (c.verdict === "BROKEN")
    return <span className="badge badge--resolved-broken">✗ Broken</span>;
  if (c.verdict === "PARTIAL")
    return <span className="badge badge--resolved-partial">~ Partial</span>;
  return null;
}

function DeadlinePill({ c }: { c: Commitment }) {
  if (c.status === "resolved") return null;
  const days = daysUntil(c.commitment_deadline);
  const color =
    days < 0 ? "var(--broken)"
    : days <= 2 ? "var(--partial)"
    : "var(--text-muted)";
  const label =
    days < 0 ? "Overdue"
    : days === 0 ? "Due today"
    : days === 1 ? "1d left"
    : `${days}d left`;
  return (
    <span style={{ fontSize: "11px", color, fontWeight: 600 }}>⏱ {label}</span>
  );
}

// ── Stats computed from a commitment list ───────────────────────
function FeedStats({ commitments }: { commitments: Commitment[] }) {
  const total   = commitments.length;
  const kept    = commitments.filter((c) => c.verdict === "KEPT").length;
  const broken  = commitments.filter((c) => c.verdict === "BROKEN").length;
  const partial = commitments.filter((c) => c.verdict === "PARTIAL").length;
  const pending = commitments.filter((c) => c.status === "committed").length;

  if (total === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
      }}
    >
      {[
        { n: total,   lbl: "total",      color: "var(--text-secondary)" },
        { n: kept,    lbl: "kept",       color: "var(--kept)"           },
        { n: partial, lbl: "partial",    color: "var(--partial)"        },
        { n: broken,  lbl: "broken",     color: "var(--broken)"         },
        { n: pending, lbl: "pending",    color: "var(--pending)"        },
      ]
        .filter(({ n }) => n > 0)
        .map(({ n, lbl, color }) => (
          <div
            key={lbl}
            style={{
              padding: "4px 10px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "100px",
              fontSize: "12px",
              display: "flex",
              gap: "5px",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 700, color }}>{n}</span>
            <span style={{ color: "var(--text-muted)" }}>{lbl}</span>
          </div>
        ))}
    </div>
  );
}

export default function ExploreScreen({
  recentCommitments,
  onLoadRecent,
  onLoadByCategory,
  onSelectCommitment,
  onCheckExpired,
  loading,
  error,
}: ExploreProps) {
  const [filter, setFilter]       = useState<ViewFilter>("all");
  const [feedLoading, setFeedLoading] = useState(false);
  const [lookupId, setLookupId]   = useState("");

  // Load on mount
  useEffect(() => {
    if (recentCommitments.length === 0) {
      setFeedLoading(true);
      onLoadRecent().finally?.(() => setFeedLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilterChange(f: ViewFilter) {
    setFilter(f);
    setFeedLoading(true);
    if (f === "all") {
      await onLoadRecent();
    } else {
      await onLoadByCategory(f);
    }
    setFeedLoading(false);
  }

  // Filter displayed list client-side for snappiness
  const displayed =
    filter === "all"
      ? recentCommitments
      : recentCommitments.filter((c) => c.category === filter);

  const isLoading = !!loading || feedLoading;

  return (
    <div className="screen fadeIn" style={{ paddingBottom: "80px" }}>

      {/* ── Header ── */}
      <div>
        <h2 className="screen-title">Explore</h2>
        <p className="screen-sub">
          Public commitments from everyone on CommitChain.
        </p>
      </div>

      {/* ── Lookup by ID ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="section-label">Look up a commitment</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="CMT000001"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && lookupId.trim()) {
                // Fake-select: find in current list or navigate to detail
                const found = recentCommitments.find(
                  (c) => c.id === lookupId.trim()
                );
                if (found) onSelectCommitment(found);
              }
            }}
            maxLength={9}
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: "16px",
              letterSpacing: "0.08em",
            }}
          />
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "0 18px", flexShrink: 0 }}
            disabled={!lookupId.trim()}
            onClick={() => {
              const found = recentCommitments.find(
                (c) => c.id === lookupId.trim()
              );
              if (found) onSelectCommitment(found);
            }}
          >
            Look up
          </button>
        </div>
        <div className="field-hint">
          Paste a commitment ID to jump straight to it.
        </div>
      </div>

      {/* ── Category filter tabs ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="section-label">Filter by category</div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            paddingBottom: "2px",
          }}
        >
          <button
            onClick={() => handleFilterChange("all")}
            style={{
              padding: "7px 14px",
              borderRadius: "100px",
              fontSize: "13px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
              transition: "all 0.15s",
              background: filter === "all" ? "var(--accent-soft)" : "transparent",
              color: filter === "all" ? "var(--accent)" : "var(--text-muted)",
              border: filter === "all"
                ? "1px solid var(--accent-border)"
                : "1px solid var(--border)",
            }}
          >
            ✦ All
          </button>
          {CATEGORIES.map((cat) => {
            const active = filter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => handleFilterChange(cat.value as ViewFilter)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "100px",
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  border: active
                    ? "1px solid var(--accent-border)"
                    : "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Feed stats ── */}
      {!isLoading && displayed.length > 0 && (
        <FeedStats commitments={displayed} />
      )}

      {/* ── Feed ── */}
      {isLoading ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Loading commitments…</span>
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            {filter === "all" ? "🔗" : getCategoryIcon(filter)}
          </div>
          <div className="empty-state-title">
            {filter === "all"
              ? "No commitments yet"
              : `No ${getCategoryLabel(filter)} commitments yet`}
          </div>
          <div className="empty-state-sub">
            Be the first to lock one in this category.
          </div>
        </div>
      ) : (
        <div className="chain-list">
          {displayed.map((c, i) => {
            const isLast = i === displayed.length - 1;
            const nodeClass =
              c.status === "resolved"
                ? `chain-node--${c.verdict?.toLowerCase() ?? "committed"}`
                : `chain-node--${c.status}`;
            const lineClass = c.verdict
              ? `chain-line--${c.verdict.toLowerCase()}`
              : "";
            const showExpireBtn =
              c.status === "committed" && isExpired(c.proof_deadline);

            return (
              <div key={c.id} className="chain-item">
                {/* Chain left rail */}
                <div className="chain-left">
                  <div className={`chain-node ${nodeClass}`} />
                  {!isLast && (
                    <div className={`chain-line ${lineClass}`} />
                  )}
                </div>

                {/* Card */}
                <div className="chain-content">
                  <div
                    className={`commitment-card commitment-card--${
                      c.status === "resolved"
                        ? c.verdict?.toLowerCase() ?? "committed"
                        : c.status
                    }`}
                    onClick={() => onSelectCommitment(c)}
                  >
                    {/* Top row: goal + badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <div className="commitment-card-goal">{c.goal_text}</div>
                      <CommitmentBadge c={c} />
                    </div>

                    {/* Category + deadline */}
                    <div className="commitment-card-meta">
                      <span className="category-chip">
                        {getCategoryIcon(c.category)}{" "}
                        {getCategoryLabel(c.category)}
                      </span>
                      <DeadlinePill c={c} />
                    </div>

                    {/* Author + ID */}
                    <div
                      style={{
                        marginTop: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                        }}
                      >
                        by{" "}
                        <strong
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {c.owner_name}
                        </strong>
                      </span>
                      <span className="id-badge">{c.id}</span>
                    </div>

                    {/* Verdict reasoning preview */}
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

                  {/* Expire button — anyone can trigger per the contract */}
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

      {error && <p className="error-text" style={{ marginTop: "8px" }}>{error}</p>}

      {/* ── Footer note ── */}
      {displayed.length > 0 && !isLoading && (
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "var(--text-muted)",
            paddingTop: "4px",
          }}
        >
          Showing {displayed.length} commitment
          {displayed.length !== 1 ? "s" : ""}.
          All records are permanent and tamper-proof.
        </div>
      )}
    </div>
  );
}
