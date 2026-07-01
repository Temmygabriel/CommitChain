"use client";
// CommitChain — My Commitments Screen
// Session 5

import { useEffect, useState } from "react";
import {
  Screen,
  Commitment,
  getCategoryIcon,
  formatDeadline,
  daysUntil,
  isExpired,
} from "../types";

interface MyCommitmentsProps {
  myCommitments: Commitment[];
  playerAddress: string;
  onLoad: () => void;
  onSelectCommitment: (c: Commitment) => void;
  onGoToSubmitProof: (c: Commitment) => void;
  onCheckExpired: (id: string) => void;
  onNavigate: (screen: Screen) => void;
  loading: string;
  error: string;
}

type Filter = "all" | "committed" | "evaluating" | "kept" | "broken" | "partial";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",        label: "All"        },
  { value: "committed",  label: "Pending"    },
  { value: "evaluating", label: "Evaluating" },
  { value: "kept",       label: "Kept"       },
  { value: "partial",    label: "Partial"    },
  { value: "broken",     label: "Broken"     },
];

function matchesFilter(c: Commitment, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "kept")    return c.status === "resolved" && c.verdict === "KEPT";
  if (filter === "broken")  return c.status === "resolved" && c.verdict === "BROKEN";
  if (filter === "partial") return c.status === "resolved" && c.verdict === "PARTIAL";
  return c.status === filter;
}

function DeadlineLabel({ c }: { c: Commitment }) {
  if (c.status === "resolved") return null;
  const days = daysUntil(c.commitment_deadline);
  const color =
    days < 0 ? "var(--broken)"
    : days <= 2 ? "var(--partial)"
    : "var(--text-muted)";
  const label =
    days < 0 ? "Overdue"
    : days === 0 ? "Due today"
    : days === 1 ? "Due tomorrow"
    : `${days}d left`;
  return (
    <span style={{ fontSize: "12px", color, fontWeight: 600 }}>
      ⏱ {label}
    </span>
  );
}

function VerdictStrip({ c }: { c: Commitment }) {
  if (c.status !== "resolved" || !c.verdict) return null;
  const map = {
    KEPT:    { color: "var(--kept)",    bg: "var(--kept-soft)",    icon: "✓", label: "KEPT"    },
    BROKEN:  { color: "var(--broken)",  bg: "var(--broken-soft)",  icon: "✗", label: "BROKEN"  },
    PARTIAL: { color: "var(--partial)", bg: "var(--partial-soft)", icon: "~", label: "PARTIAL" },
  };
  const v = map[c.verdict];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        background: v.bg,
        borderRadius: "var(--radius)",
        marginTop: "8px",
      }}
    >
      <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", color: v.color }}>
        {v.icon}
      </span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: v.color, letterSpacing: "0.06em" }}>
        {v.label}
      </span>
      {c.reasoning && (
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          — {c.reasoning}
        </span>
      )}
    </div>
  );
}

export default function MyCommitmentsScreen({
  myCommitments,
  playerAddress,
  onLoad,
  onSelectCommitment,
  onGoToSubmitProof,
  onCheckExpired,
  onNavigate,
  loading,
  error,
}: MyCommitmentsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const isLoading = !!loading;

  useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = myCommitments.filter((c) => matchesFilter(c, filter));

  // Open commitments that need proof and aren't expired
  const needsProof = myCommitments.filter(
    (c) =>
      c.status === "committed" &&
      !isExpired(c.proof_deadline) &&
      daysUntil(c.commitment_deadline) <= 0
  );

  // Open count for cap display
  const openCount = myCommitments.filter(
    (c) => c.status === "committed" || c.status === "evaluating"
  ).length;

  return (
    <div className="screen fadeIn" style={{ paddingBottom: "80px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="screen-title">My Commitments</h2>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: openCount >= 5 ? "var(--broken)" : "var(--text-muted)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "3px 8px",
          }}
        >
          {openCount}/5 open
        </div>
      </div>

      {/* ── Action needed banner ── */}
      {needsProof.length > 0 && (
        <div
          className="card card--accent fadeIn"
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            📋 Proof due for {needsProof.length} commitment
            {needsProof.length > 1 ? "s" : ""}
          </div>
          {needsProof.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  flex: 1,
                  lineHeight: 1.4,
                }}
              >
                {c.goal_text}
              </div>
              <button
                className="btn-secondary"
                style={{
                  width: "auto",
                  padding: "6px 14px",
                  fontSize: "13px",
                  flexShrink: 0,
                }}
                onClick={() => onGoToSubmitProof(c)}
              >
                Submit proof →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {FILTERS.map(({ value, label }) => {
          const count =
            value === "all"
              ? myCommitments.length
              : myCommitments.filter((c) => matchesFilter(c, value)).length;
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                transition: "all 0.15s",
                background: active ? "var(--accent-soft)" : "rgba(255,255,255,0.03)",
                color: active ? "var(--accent)" : "var(--text-muted)",
                border: active
                  ? "1px solid var(--accent-border)"
                  : "1px solid var(--border)",
              }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: "5px", opacity: 0.7 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {isLoading && myCommitments.length === 0 ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Loading your commitments…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            {filter === "all" ? "🔗" : "◎"}
          </div>
          <div className="empty-state-title">
            {filter === "all"
              ? "No commitments yet"
              : `No ${filter} commitments`}
          </div>
          <div className="empty-state-sub">
            {filter === "all"
              ? "Lock your first commitment and start building your record."
              : "Switch filters or make a new commitment."}
          </div>
          {filter === "all" && (
            <button
              className="btn-primary"
              style={{ marginTop: "12px", width: "auto", padding: "10px 24px" }}
              onClick={() => onNavigate("create_commitment")}
            >
              + Make a Commitment
            </button>
          )}
        </div>
      ) : (
        <div className="chain-list">
          {filtered.map((c, i) => {
            const isLast = i === filtered.length - 1;
            const nodeClass =
              c.status === "resolved"
                ? `chain-node--${c.verdict?.toLowerCase() ?? "committed"}`
                : `chain-node--${c.status}`;
            const lineClass =
              c.verdict ? `chain-line--${c.verdict.toLowerCase()}` : "";

            const canSubmitProof =
              c.status === "committed" &&
              daysUntil(c.commitment_deadline) <= 0 &&
              !isExpired(c.proof_deadline);

            const canMarkExpired =
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
                  {/* Card */}
                  <div
                    className={`commitment-card commitment-card--${
                      c.status === "resolved"
                        ? c.verdict?.toLowerCase() ?? "committed"
                        : c.status
                    }`}
                    onClick={() => onSelectCommitment(c)}
                  >
                    {/* Top row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <div className="commitment-card-goal">{c.goal_text}</div>
                      <span className="category-chip" style={{ flexShrink: 0 }}>
                        {getCategoryIcon(c.category)}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="commitment-card-meta">
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {c.id}
                      </span>
                      <DeadlineLabel c={c} />
                      {c.status === "evaluating" && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--accent)",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <span
                            className="spinner"
                            style={{ width: "10px", height: "10px", borderWidth: "1.5px" }}
                          />
                          AI evaluating…
                        </span>
                      )}
                    </div>

                    {/* Verdict strip */}
                    <VerdictStrip c={c} />
                  </div>

                  {/* Action buttons below card */}
                  {canSubmitProof && (
                    <button
                      className="btn-primary"
                      style={{ marginTop: "8px", fontSize: "13px", padding: "10px 16px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGoToSubmitProof(c);
                      }}
                    >
                      📋 Submit Proof →
                    </button>
                  )}

                  {canMarkExpired && (
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

      {error && <p className="error-text">{error}</p>}

      {/* ── Cap warning ── */}
      {openCount >= 5 && (
        <div className="info-box info-box--warn">
          ⚠️ You have 5 open commitments — the maximum allowed. Submit proof or
          wait for existing ones to resolve before making a new commitment.
        </div>
      )}

      {/* ── New commitment CTA ── */}
      {myCommitments.length > 0 && openCount < 5 && (
        <button
          className="btn-secondary"
          onClick={() => onNavigate("create_commitment")}
        >
          + New Commitment
        </button>
      )}
    </div>
  );
}
