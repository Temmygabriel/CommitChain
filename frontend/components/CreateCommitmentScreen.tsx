"use client";
// CommitChain — Create Commitment Screen
// Session 4

import { useState, useEffect } from "react";
import { Category, CATEGORIES } from "../types";

interface CreateCommitmentProps {
  playerName: string;
  onSubmit: (params: {
    goalText: string;
    criteriaText: string;
    category: Category;
    commitmentDeadline: string;
  }) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

// Minimum deadline: tomorrow
function minDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// Criteria specificity score 0–100 (simple heuristic — no AI call needed here)
function scoreCriteria(text: string): number {
  if (!text.trim()) return 0;
  const words     = text.trim().split(/\s+/).length;
  const hasNumber = /\d/.test(text);
  const hasVerb   = /\b(will|submit|complete|finish|deliver|send|run|write|publish|ship|record|log|do|make|build|read|attend|practice)\b/i.test(text);
  const hasBy     = /\b(by|before|within|on|at)\b/i.test(text);
  let score = 0;
  if (words >= 8)   score += 30;
  else if (words >= 4) score += 15;
  if (hasNumber)  score += 25;
  if (hasVerb)    score += 25;
  if (hasBy)      score += 20;
  return Math.min(score, 100);
}

function CriteriaQuality({ criteria }: { criteria: string }) {
  const score = scoreCriteria(criteria);
  const cls =
    score >= 70 ? "progress-bar-fill--good"
    : score >= 40 ? "progress-bar-fill--warn"
    : "progress-bar-fill--danger";
  const label =
    score >= 70 ? "Strong — AI can verify this"
    : score >= 40 ? "Moderate — consider adding a number or specific action"
    : criteria.trim() ? "Weak — too vague to verify later"
    : "";

  if (!criteria.trim()) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${cls}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div
        style={{
          fontSize: "12px",
          color:
            score >= 70
              ? "var(--kept)"
              : score >= 40
              ? "var(--partial)"
              : "var(--broken)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function CreateCommitmentScreen({
  playerName,
  onSubmit,
  onBack,
  loading,
  error,
}: CreateCommitmentProps) {
  const [goalText, setGoalText]     = useState("");
  const [criteriaText, setCriteriaText] = useState("");
  const [category, setCategory]     = useState<Category>("other");
  const [deadline, setDeadline]     = useState("");
  const [step, setStep]             = useState<1 | 2 | 3>(1);

  const isLoading = !!loading;

  // Step 1 valid
  const step1Valid = goalText.trim().length >= 5 && category;

  // Step 2 valid
  const step2Valid = criteriaText.trim().length >= 10;

  // Step 3 valid
  const step3Valid = !!deadline && deadline >= minDeadline();

  const canSubmit = step1Valid && step2Valid && step3Valid && !isLoading;

  // Criteria score for quality bar
  const criteriaScore = scoreCriteria(criteriaText);

  // Show days from now for deadline preview
  function deadlineDaysLabel(): string {
    if (!deadline) return "";
    const days = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ goalText: goalText.trim(), criteriaText: criteriaText.trim(), category, commitmentDeadline: deadline });
  }

  const STEP_LABELS = ["Goal", "Criteria", "Deadline"];

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Back</button>

      {/* ── Header ── */}
      <div>
        <h2 className="screen-title">New Commitment</h2>
        <p className="screen-sub">
          Write this carefully — it locks on-chain and cannot be changed.
        </p>
      </div>

      {/* ── Step indicator ── */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done   = step > n;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  border: `2px solid ${done ? "var(--kept)" : active ? "var(--accent)" : "var(--border)"}`,
                  background: done ? "var(--kept-soft)" : active ? "var(--accent-soft)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: done ? "var(--kept)" : active ? "var(--accent)" : "var(--text-muted)",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {done ? "✓" : n}
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: done ? "var(--kept-border)" : "var(--border)",
                    width: "20px",
                    marginLeft: "4px",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Goal + Category ── */}
      {step === 1 && (
        <div className="form-section fadeIn">
          <div className="form-section-title">What are you committing to?</div>

          {/* Category picker */}
          <div className="field-group">
            <label className="field-label">Category</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "100px",
                    border: `1px solid ${category === c.value ? "var(--accent-border)" : "var(--border)"}`,
                    background: category === c.value ? "var(--accent-soft)" : "transparent",
                    color: category === c.value ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal */}
          <div className="field-group">
            <label className="field-label">Your goal — one clear sentence</label>
            <textarea
              placeholder={
                category === "fitness"  ? "e.g. Run 3 times this week without skipping"
                : category === "work"   ? "e.g. Submit the client proposal by Friday"
                : category === "habit"  ? "e.g. Not open social media before 10am for 7 days"
                : category === "learning" ? "e.g. Complete the JavaScript module on Scrimba"
                : "e.g. Call my parents at least once this week"
              }
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              maxLength={200}
              style={{ minHeight: "80px" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              {goalText.length}/200
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={() => setStep(2)}
            disabled={!step1Valid}
          >
            Set Criteria →
          </button>
        </div>
      )}

      {/* ── Step 2: Criteria ── */}
      {step === 2 && (
        <div className="form-section fadeIn">
          <div className="form-section-title">How will you prove it?</div>

          {/* Goal recap */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--surface-2)",
              borderRadius: "var(--radius)",
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              borderLeft: "3px solid var(--accent)",
            }}
          >
            {goalText}
          </div>

          <div className="info-box">
            ⚖️ Write these criteria as if for a strict judge who has never met you.
            Vague criteria = vague verdict. The AI can only rule on what you
            write here, not your intentions.
          </div>

          <div className="field-group">
            <label className="field-label">
              Success criteria — specific and verifiable
            </label>
            <textarea
              placeholder={
                category === "fitness"
                  ? "e.g. I will submit 3 separate workout logs with dates and durations. Each log will note the activity and how long I ran."
                  : category === "work"
                  ? "e.g. I will share a link to the submitted proposal email or a PDF attachment confirming it was sent before 5pm Friday."
                  : category === "habit"
                  ? "e.g. I will provide a daily screenshot of my screen time report showing 0 minutes of social media before 10am for 7 consecutive days."
                  : "e.g. I will describe exactly what I did, with specific dates, numbers, or evidence that can be cross-checked."
              }
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              maxLength={600}
              style={{ minHeight: "120px" }}
            />
            <CriteriaQuality criteria={criteriaText} />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              {criteriaText.length}/600
            </div>
          </div>

          {/* Criteria tips */}
          {criteriaScore < 70 && criteriaText.trim() && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div className="section-label">Make it stronger</div>
              {!(/\d/.test(criteriaText)) && (
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  → Add a number (how many times, how long, a specific date)
                </div>
              )}
              {!(/\b(submit|share|send|log|record|show|provide|upload|attach)\b/i.test(criteriaText)) && (
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  → Describe what evidence you'll submit (a link, a screenshot, a log)
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn-outline"
              onClick={() => setStep(1)}
              style={{ flex: 1 }}
            >
              ← Back
            </button>
            <button
              className="btn-primary"
              onClick={() => setStep(3)}
              disabled={!step2Valid}
              style={{ flex: 2 }}
            >
              Set Deadline →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Deadline ── */}
      {step === 3 && (
        <div className="form-section fadeIn">
          <div className="form-section-title">When is your deadline?</div>

          {/* Recap */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--surface-2)",
              borderRadius: "var(--radius)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
              {goalText}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {criteriaText}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Commitment deadline</label>
            <input
              type="date"
              min={minDeadline()}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            {deadline && (
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {deadlineDaysLabel()} · You have 48 hours after this date to submit proof.
              </div>
            )}
          </div>

          {/* Quick deadline buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { label: "1 week",  days: 7  },
              { label: "2 weeks", days: 14 },
              { label: "1 month", days: 30 },
              { label: "3 months",days: 90 },
            ].map(({ label, days }) => {
              const d = new Date();
              d.setDate(d.getDate() + days);
              const val = d.toISOString().split("T")[0];
              return (
                <button
                  key={label}
                  onClick={() => setDeadline(val)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "100px",
                    border: `1px solid ${deadline === val ? "var(--accent-border)" : "var(--border)"}`,
                    background: deadline === val ? "var(--accent-soft)" : "transparent",
                    color: deadline === val ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* What happens after */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div className="section-label">What happens after you submit</div>
            {[
              ["🔒", "Commitment is locked on-chain immediately"],
              ["📋", "On your deadline, submit your proof"],
              ["⏱", "48h grace window for proof submission"],
              ["⚖️", "AI takes 3–5 min to evaluate and rule"],
              ["∞", "Verdict is permanent and public"],
            ].map(([icon, text]) => (
              <div
                key={String(text)}
                style={{
                  display: "flex",
                  gap: "10px",
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

          {error && <p className="error-text">{error}</p>}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="btn-outline"
              onClick={() => setStep(2)}
              style={{ flex: 1 }}
            >
              ← Back
            </button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{ flex: 2 }}
            >
              {isLoading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  {loading}
                </span>
              ) : (
                "🔒 Lock This Commitment"
              )}
            </button>
          </div>

          <p className="hint-text">
            This cannot be edited once submitted. Write it right.
          </p>
        </div>
      )}
    </div>
  );
}
