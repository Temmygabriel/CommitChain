"use client";
// CommitChain — Import Key Screen
// Session 4

import { useState } from "react";

interface ImportKeyProps {
  onImport: (privateKey: string) => void;
  onBack: () => void;
  error: string;
}

export default function ImportKeyScreen({ onImport, onBack, error }: ImportKeyProps) {
  const [keyInput, setKeyInput] = useState("");
  const canImport = keyInput.trim().startsWith("0x") && keyInput.trim().length > 10;

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div>
        <h2 className="screen-title">Import Your Key</h2>
        <p className="screen-sub">
          Restore your CommitChain identity on a new device by pasting
          your saved private key.
        </p>
      </div>

      {/* Warning */}
      <div className="info-box info-box--warn">
        <strong>⚠️ Keep this private.</strong> Your private key is like a password —
        never share it with anyone. CommitChain never sends it anywhere; it stays
        in your browser's local storage only.
      </div>

      {/* Input */}
      <div className="form-section">
        <div className="form-section-title">Private Key</div>
        <div className="field-group">
          <label className="field-label">Paste your key below</label>
          <textarea
            placeholder="0x..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              minHeight: "80px",
              wordBreak: "break-all",
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <p className="field-hint">
            Must start with <span style={{ fontFamily: "var(--font-mono)" }}>0x</span>.
            You saved this when you first used CommitChain.
          </p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn-primary"
        onClick={() => onImport(keyInput)}
        disabled={!canImport}
      >
        Restore My Identity →
      </button>

      {/* How to find your key */}
      <div
        style={{
          padding: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="section-label">Where to find your key</div>
        {[
          ["1", "On your original device, open CommitChain"],
          ["2", "Go to Profile → tap your address"],
          ["3", "Tap 'Export Key' to reveal and copy it"],
        ].map(([step, text]) => (
          <div
            key={step}
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.1rem",
                color: "var(--accent)",
                minWidth: "16px",
                lineHeight: 1,
                paddingTop: "2px",
              }}
            >
              {step}
            </span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
