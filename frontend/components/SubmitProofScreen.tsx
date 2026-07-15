"use client";
// CommitChain — Submit Proof Screen
// Updated: reflects on-chain deadline enforcement
// - Proof can only be submitted AFTER the commitment deadline has passed
// - Proof window closes 48h after that (proof_deadline)
// - Both are now enforced on-chain; frontend matches the same logic

import { useState } from "react";
import { Commitment, formatDeadline, daysUntil, isExpired } from "../types";

interface SubmitProofProps {
  commitment: Commitment;
  onSubmit: (params: { proofText: string; proofLink: string }) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

export default function SubmitProofScreen({
  commitment,
  onSubmit,
  onBack,
  loading,
  error,
}: SubmitProofProps) {
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const isLoading = !!loading;

  // Commitment deadline: must have PASSED before proof can be submitted
  const commitmentDaysLeft = daysUntil(commitment.commitment_deadline);
  const commitmentDeadlinePassed = commitmentDaysLeft < 0;

  // Proof window: must still be open
  const proofWindowClosed = isExpired(commitment.proof_deadline);
  const proofDaysLeft = daysUntil(commitment.proof_deadline);

  // Submission is only possible when commitment deadline passed AND proof window open
  const windowOpen = commitmentDeadlinePassed && !proofWindowClosed;

  const canSubmit =
    windowOpen &&
    proofText.trim().length >= 20 &&
    acknowledged &&
    !isLoading;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      proofText: proofText.trim(),
      proofLink: proofLink.trim(),
    });
  }

  // Proof strength heuristic
  function proofStrength(): number {
    if (!proofText.trim()) return 0;
    const words      = proofText.trim().split(/\s+/).length;
    const hasDate    = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today)\b/i.test(proofText);
    const hasNumber  = /\d+/.test(proofText);
    const hasLink    = proofLink.trim().startsWith("http");
    let score = 0;
    if (words >= 30) score += 35;
    else if (words >= 15) score += 20;
    else if (words >= 5)  score += 10;
    if (hasDate)   score += 25;
    if (hasNumber) score += 20;
    if (hasLink)   score += 20;
    return Math.min(score, 100);
  }

  const strength = proofStrength();
  const strengthColor =
    strength >= 70 ? "var(--kept)"
    : strength >= 40 ? "var(--partial)"
    : "var(--broken)";

  const strengthLabel =
    strength >= 70 ? "Strong proof"
    : strength >= 40 ? "Moderate — add more detail or a link"
    : proofText.trim() ? "Weak — the AI needs more to rule in your favour"
    : "";

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Commitment</button>

      <div>
        <h2 className="screen-title">Submit Proof</h2>
        <p className="screen-sub">
          The AI will compare this against your original criteria. Be specific and thorough.
        </p>
      </div>

      {/* ── Window status banner ── */}
      {!commitmentDeadlinePassed ? (
        // Too early — commitment deadline hasn't passed yet
        <div className="info-box info-box--warn">
          ⏳ Your commitment deadline is{" "}
          <strong>{formatDeadline(commitment.commitment_deadline)}</strong> —{" "}
          {Math.abs(commitmentDaysLeft)} day{Math.abs(commitmentDaysLeft) !== 1 ? "s" : ""} from now.
          Proof submission opens once your deadline has passed. Come back then.
        </div>
      ) : proofWindowClosed ? (
        // Too late — proof window already closed
        <div className="info-box info-box--danger">
          ⚠️ The 48-hour proof window closed on{" "}
          <strong>{formatDeadline(commitment.proof_deadline)}</strong>.
          No proof can be submitted. This commitment can now be marked BROKEN.
        </div>
      ) : proofDaysLeft <= 1 ? (
        // Open but urgent
        <div className="info-box info-box--warn">
          ⏱ Proof window closes in less than 24 hours (
          {formatDeadline(commitment.proof_deadline)}). Submit now.
        </div>
      ) : (
        // Normal open state
        <div className="info-box" style={{ color: "var(--text-2)" }}>
          ✅ Proof window open until{" "}
          <strong style={{ color: "var(--text-1)" }}>
            {formatDeadline(commitment.proof_deadline)}
          </strong>{" "}
          ({proofDaysLeft} day{proofDaysLeft !== 1 ? "s" : ""} remaining)
        </div>
      )}

      {/* ── Original commitment recap ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 16px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-3)",
          }}
        >
          What you committed to
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>Goal</div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-1)",
                lineHeight: 1.4,
              }}
            >
              {commitment.goal_text}
            </div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>
              Success criteria — the AI judges your proof against this
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "var(--text-2)",
                lineHeight: 1.6,
                padding: "10px 12px",
                background: "var(--surface-2)",
                borderRadius: "var(--r)",
                borderLeft: "3px solid var(--accent)",
              }}
            >
              {commitment.criteria_text}
            </div>
          </div>
        </div>
      </div>

      {/* ── Evidence quality note — visible when window is open ── */}
      {windowOpen && (
        <div className="info-box">
          ⚖️ The AI now assesses evidence quality, not just narrative.
          Specific numbers, dates, and a supporting link significantly
          strengthen your case. A vague description against specific criteria
          will score PARTIAL or BROKEN.
        </div>
      )}

      {/* ── Proof form — only shown when window is open ── */}
      {windowOpen && (
        <div className="form-section">
          <div className="form-section-title">Your Proof</div>

          <div className="field-group">
            <label className="field-label">
              What actually happened — be specific
            </label>
            <textarea
              placeholder={`Describe exactly what you did to meet the criteria. Include:\n• Specific dates (e.g. "ran on Jul 10, 12, and 14")\n• Numbers (distances, counts, durations)\n• Named outputs (file names, PR links, document titles)\n\nThe AI compares this against:\n"${commitment.criteria_text}"`}
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              maxLength={1000}
              style={{ minHeight: "160px" }}
              disabled={isLoading}
            />

            {/* Proof strength bar */}
            {proofText.trim() && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${strength}%`, background: strengthColor }}
                  />
                </div>
                <div style={{ fontSize: "12px", color: strengthColor }}>
                  {strengthLabel}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: "11px",
                color: "var(--text-3)",
              }}
            >
              {proofText.length}/1000
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Evidence link (recommended)</label>
            <input
              type="url"
              placeholder="https:// — Strava, GitHub PR, Google Doc, screenshot, etc."
              value={proofLink}
              onChange={(e) => setProofLink(e.target.value)}
              disabled={isLoading}
            />
            <p className="field-hint">
              A supporting link gives the AI stronger evidence to rule KEPT.
              Describe its contents in the text above — the link itself isn't fetched,
              but its presence signals you have verifiable evidence.
            </p>
          </div>

          {/* Strength tips */}
          {strength < 70 && proofText.trim().length > 10 && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div className="section-label">Strengthen your proof</div>
              {proofText.trim().split(/\s+/).length < 15 && (
                <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  → Write more — at least 15–20 words describing what happened
                </div>
              )}
              {!(/\d/.test(proofText)) && (
                <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  → Add specific numbers (distances, times, counts, percentages)
                </div>
              )}
              {!(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|monday|tuesday|wednesday|thursday|friday/i.test(proofText)) && (
                <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  → Include specific dates when things happened
                </div>
              )}
              {!proofLink.startsWith("http") && (
                <div style={{ fontSize: "13px", color: "var(--text-2)" }}>
                  → Add a link to supporting evidence (Strava, GitHub, Google Docs, etc.)
                </div>
              )}
            </div>
          )}

          {/* Acknowledgement checkbox */}
          <label
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
              cursor: "pointer",
              padding: "12px",
              background: acknowledged ? "var(--accent-bg)" : "var(--surface-2)",
              border: `1px solid ${acknowledged ? "var(--accent-border)" : "var(--border)"}`,
              borderRadius: "var(--r)",
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ marginTop: "2px", accentColor: "var(--accent)", flexShrink: 0 }}
              disabled={isLoading}
            />
            <span style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>
              I understand this proof submission is final and cannot be changed.
              The AI will judge it strictly against my original criteria, and the
              verdict will be permanently recorded on-chain.
            </span>
          </label>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {windowOpen && (
        <>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ fontSize: "16px", padding: "16px 24px" }}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="spinner" />
                {loading}
              </span>
            ) : (
              "Submit for AI Judgment →"
            )}
          </button>

          <p className="hint-text">
            AI evaluation takes 3–5 minutes on GenLayer studionet. You'll see
            the result on the next screen — or come back using your commitment ID{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>
              {commitment.id}
            </span>
            .
          </p>
        </>
      )}
    </div>
  );
}
