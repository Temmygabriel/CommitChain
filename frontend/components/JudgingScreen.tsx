"use client";
// CommitChain — Judging Screen
// Session 5
// Shown after submit_proof fires and while evaluate_commitment runs.
// Polls externally (from App.tsx) — this component is purely presentational.

import { useState } from "react";
import { Commitment, getCategoryIcon } from "../types";

interface JudgingProps {
  commitmentId: string;
  commitment: Commitment | null;
  onGoHome: () => void;
  onViewMine: () => void;
}

export default function JudgingScreen({
  commitmentId,
  commitment,
  onGoHome,
  onViewMine,
}: JudgingProps) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    const text = commitmentId || commitment?.id || "";
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity  = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  }

  const displayId = commitmentId || commitment?.id || "";

  return (
    <div className="judging-shell fadeIn">

      {/* ── Dual-ring spinner ── */}
      <div className="judging-ring">
        <div className="judging-ring-circle" />
        <div className="judging-ring-inner" />
      </div>

      {/* ── Title ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
        <h2 className="judging-title">AI is judging</h2>

        {commitment && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "100px",
              fontSize: "13px",
              color: "var(--text-secondary)",
            }}
          >
            <span>{getCategoryIcon(commitment.category)}</span>
            <span style={{ fontStyle: "italic" }}>
              "{commitment.goal_text.length > 60
                ? commitment.goal_text.slice(0, 57) + "…"
                : commitment.goal_text}"
            </span>
          </div>
        )}
      </div>

      {/* ── Sub ── */}
      <p className="judging-sub">
        Reading your original criteria. Comparing against your proof.
        Reaching consensus across validators.
      </p>

      {/* ── Animated dots ── */}
      <div className="ai-dots">
        <span /><span /><span />
      </div>

      {/* ── Time estimate ── */}
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        This takes{" "}
        <strong style={{ color: "var(--accent)" }}>3–5 minutes</strong> on
        GenLayer studionet.
        <br />
        You can leave — use your commitment ID to return.
      </div>

      {/* ── ID box — save this to come back ── */}
      {displayId && (
        <div className="judging-id-box">
          <div className="judging-id-label">Your Commitment ID — save this</div>
          <div
            className="judging-id-value"
            onClick={copyId}
            title="Click to copy"
          >
            {displayId}
          </div>
          <button
            className={`judging-id-copy${copied ? " judging-id-copy--copied" : ""}`}
            onClick={copyId}
          >
            {copied ? "✓ Copied!" : "Copy ID"}
          </button>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Paste this into the lookup bar on the home screen to see your
            result later.
          </div>
        </div>
      )}

      {/* ── What the AI checks ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        <div className="section-label">What the AI is doing right now</div>
        {[
          ["📜", "Reading your locked success criteria"],
          ["📋", "Reading your submitted proof"],
          ["🔍", "Checking proof against each criterion"],
          ["⚖️",  "Forming a KEPT / PARTIAL / BROKEN verdict"],
          ["🔗", "Reaching consensus across validators"],
        ].map(([icon, text]) => (
          <div
            key={String(text)}
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ flexShrink: 0 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* ── Escape buttons ── */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        <button className="btn-outline" onClick={onGoHome} style={{ flex: 1 }}>
          ← Home
        </button>
        <button className="btn-secondary" onClick={onViewMine} style={{ flex: 1 }}>
          My Commitments →
        </button>
      </div>

    </div>
  );
}
