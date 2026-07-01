"use client";
// CommitChain — Commitment Detail Screen
// Session 6
// The verdict reveal screen — the DM Serif Display moment.

import { useState } from "react";
import {
  Commitment,
  getCategoryIcon,
  getCategoryLabel,
  formatDeadline,
  daysUntil,
  isExpired,
} from "../types";

interface CommitmentDetailProps {
  commitment: Commitment;
  playerAddress: string;
  onGoToSubmitProof: () => void;
  onCheckExpired: () => void;
  onBack: () => void;
  onRefresh: () => void;
  loading: string;
  error: string;
}

// ── Verdict config ──────────────────────────────────────────────
const VERDICT_CONFIG = {
  KEPT: {
    icon:        "✓",
    word:        "Kept",
    color:       "var(--kept)",
    bg:          "var(--kept-soft)",
    border:      "var(--kept-border)",
    cls:         "verdict-word--kept",
    cardCls:     "card--kept",
    message:     "You did what you said you would do. That's the whole thing.",
  },
  BROKEN: {
    icon:        "✗",
    word:        "Broken",
    color:       "var(--broken)",
    bg:          "var(--broken-soft)",
    border:      "var(--broken-border)",
    cls:         "verdict-word--broken",
    cardCls:     "card--broken",
    message:     "This one didn't land. That's permanent — and useful. Now you know.",
  },
  PARTIAL: {
    icon:        "~",
    word:        "Partial",
    color:       "var(--partial)",
    bg:          "var(--partial-soft)",
    border:      "var(--partial-border)",
    cls:         "verdict-word--partial",
    cardCls:     "card--partial",
    message:     "You got some of the way there. Partial doesn't reset your streak — but it doesn't build it either.",
  },
};

// ── Confidence badge ────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const map: Record<string, { color: string; label: string }> = {
    HIGH:   { color: "var(--kept)",    label: "High confidence"   },
    MEDIUM: { color: "var(--partial)", label: "Medium confidence" },
    LOW:    { color: "var(--broken)",  label: "Low confidence"    },
  };
  const c = map[confidence];
  if (!c) return null;
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

// ── Status section for non-resolved commitments ─────────────────
function PendingSection({
  commitment,
  playerAddress,
  onGoToSubmitProof,
  onCheckExpired,
  loading,
}: {
  commitment: Commitment;
  playerAddress: string;
  onGoToSubmitProof: () => void;
  onCheckExpired: () => void;
  loading: string;
}) {
  const isOwn       = commitment.owner_address === playerAddress;
  const days        = daysUntil(commitment.commitment_deadline);
  const proofOpen   = !isExpired(commitment.proof_deadline);
  const deadlinePast = days <= 0;
  const isLoading   = !!loading;

  if (commitment.status === "evaluating") {
    return (
      <div
        className="card card--accent"
        style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}
      >
        <div className="ai-dots">
          <span /><span /><span />
        </div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent)" }}>
          AI is evaluating this commitment
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Proof was submitted. The AI is comparing it against the original
          criteria across multiple validators. This takes 3–5 minutes.
        </div>
      </div>
    );
  }

  // committed status
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Deadline status */}
      <div
        style={{
          padding: "14px 16px",
          background: deadlinePast ? "var(--broken-soft)" : "var(--surface)",
          border: `1px solid ${deadlinePast ? "var(--broken-border)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div className="section-label">Commitment deadline</div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.4rem",
            color: deadlinePast ? "var(--broken)" : "var(--text-primary)",
          }}
        >
          {formatDeadline(commitment.commitment_deadline)}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          {days < 0
            ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
            : days === 0
            ? "Due today"
            : days === 1
            ? "Due tomorrow"
            : `${days} days remaining`}
        </div>
      </div>

      {/* Proof window */}
      {deadlinePast && (
        <div
          style={{
            padding: "14px 16px",
            background: proofOpen ? "var(--accent-soft)" : "var(--broken-soft)",
            border: `1px solid ${proofOpen ? "var(--accent-border)" : "var(--broken-border)"}`,
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div className="section-label">Proof window</div>
          <div
            style={{
              fontSize: "13px",
              color: proofOpen ? "var(--accent)" : "var(--broken)",
              fontWeight: 600,
            }}
          >
            {proofOpen
              ? `Open until ${formatDeadline(commitment.proof_deadline)}`
              : "Closed — proof window expired"}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isOwn && deadlinePast && proofOpen && (
        <button
          className="btn-primary"
          onClick={onGoToSubmitProof}
          disabled={isLoading}
          style={{ fontSize: "15px" }}
        >
          📋 Submit Your Proof →
        </button>
      )}

      {!proofOpen && (
        <button
          className="btn-outline"
          onClick={onCheckExpired}
          disabled={isLoading}
          style={{ color: "var(--broken)", borderColor: "var(--broken-border)" }}
        >
          {isLoading ? (
            <span className="btn-loading">
              <span className="spinner" />
              Marking…
            </span>
          ) : (
            "Mark as BROKEN (no proof submitted)"
          )}
        </button>
      )}

      {!deadlinePast && (
        <div className="info-box">
          ⏳ Proof submission opens when the commitment deadline passes.
          Come back on <strong>{formatDeadline(commitment.commitment_deadline)}</strong>.
        </div>
      )}
    </div>
  );
}

export default function CommitmentDetail({
  commitment,
  playerAddress,
  onGoToSubmitProof,
  onCheckExpired,
  onBack,
  onRefresh,
  loading,
  error,
}: CommitmentDetailProps) {
  const [showCriteria, setShowCriteria] = useState(false);
  const [showProof, setShowProof]       = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const isResolved = commitment.status === "resolved";
  const verdict    = commitment.verdict;
  const vc         = verdict ? VERDICT_CONFIG[verdict] : null;
  const isOwn      = commitment.owner_address === playerAddress;

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  return (
    <div className="screen fadeIn">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button className="back-btn" onClick={onBack}>← Back</button>
        <button
          className="btn-ghost"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* ── ID + category row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span className="id-badge">{commitment.id}</span>
        <span className="category-chip">
          {getCategoryIcon(commitment.category)}{" "}
          {getCategoryLabel(commitment.category)}
        </span>
        {isOwn && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "0.06em",
            }}
          >
            YOUR COMMITMENT
          </span>
        )}
      </div>

      {/* ── Goal ── */}
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.2rem, 5vw, 1.5rem)",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
        }}
      >
        {commitment.goal_text}
      </div>

      {/* ── By + deadline ── */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          fontSize: "13px",
          color: "var(--text-muted)",
        }}
      >
        <span>
          by{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {commitment.owner_name}
          </strong>
        </span>
        <span>
          Deadline:{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {formatDeadline(commitment.commitment_deadline)}
          </strong>
        </span>
      </div>

      <div className="divider" />

      {/* ── VERDICT REVEAL — the DM Serif moment ── */}
      {isResolved && vc && (
        <div
          className={`card ${vc.cardCls} fadeIn`}
          style={{ display: "flex", flexDirection: "column", gap: "0" }}
        >
          <div className="verdict-reveal">
            {/* Big serif verdict word */}
            <div className="verdict-icon">{vc.icon}</div>
            <div className={`verdict-word ${vc.cls}`}>{vc.word}</div>

            {/* Confidence */}
            <ConfidenceBadge confidence={commitment.confidence} />

            {/* AI reasoning */}
            {commitment.reasoning && (
              <div className="verdict-reasoning">
                "{commitment.reasoning}"
              </div>
            )}

            {/* Flavour message */}
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontStyle: "normal",
                marginTop: "4px",
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {vc.message}
            </div>
          </div>
        </div>
      )}

      {/* ── Pending / evaluating state ── */}
      {!isResolved && (
        <PendingSection
          commitment={commitment}
          playerAddress={playerAddress}
          onGoToSubmitProof={onGoToSubmitProof}
          onCheckExpired={onCheckExpired}
          loading={loading}
        />
      )}

      {/* ── Criteria accordion ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowCriteria(!showCriteria)}
          style={{
            width: "100%",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.04em",
            }}
          >
            📜 Original success criteria
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            {showCriteria ? "▲" : "▼"}
          </span>
        </button>
        {showCriteria && (
          <div
            style={{
              padding: "0 18px 18px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                marginTop: "14px",
                fontSize: "14px",
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                borderLeft: "3px solid var(--accent)",
                paddingLeft: "14px",
              }}
            >
              {commitment.criteria_text}
            </div>
            <div
              style={{
                marginTop: "10px",
                fontSize: "11px",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              Locked on-chain at submission — this text cannot be changed.
            </div>
          </div>
        )}
      </div>

      {/* ── Proof accordion — only if proof was submitted ── */}
      {commitment.proof_text && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowProof(!showProof)}
            style={{
              width: "100%",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}
            >
              📋 Submitted proof
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              {showProof ? "▲" : "▼"}
            </span>
          </button>
          {showProof && (
            <div
              style={{
                padding: "0 18px 18px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  marginTop: "14px",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                {commitment.proof_text}
              </div>
              {commitment.proof_link && (
                <a
                  href={commitment.proof_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "13px",
                    color: "var(--accent)",
                    wordBreak: "break-all",
                    textDecoration: "none",
                  }}
                >
                  🔗 {commitment.proof_link}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Proof deadline (if not yet expired and not resolved) ── */}
      {!isResolved && commitment.status === "committed" && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          Proof window closes:{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {formatDeadline(commitment.proof_deadline)}
          </strong>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {/* ── Permanence note ── */}
      {isResolved && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: "12px",
            color: "var(--text-muted)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          This verdict is permanent. It cannot be edited, deleted, or appealed.
          It is part of your on-chain record forever.
        </div>
      )}
    </div>
  );
}
