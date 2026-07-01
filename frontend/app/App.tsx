"use client";
// CommitChain — Main Orchestrator
// Session 3

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Screen,
  Commitment,
  Profile,
  Category,
  isExpired,
} from "../types";
import {
  makeAccount,
  createCommitment,
  submitProof,
  evaluateCommitment,
  checkExpired,
  getCommitment,
  getMyCommitments,
  getProfile,
  getRecentCommitments,
  getCommitmentsByCategory,
} from "../lib/contract";

import LandingScreen       from "../components/LandingScreen";
import CreateCommitmentScreen from "../components/CreateCommitmentScreen";
import MyCommitmentsScreen from "../components/MyCommitmentsScreen";
import SubmitProofScreen   from "../components/SubmitProofScreen";
import CommitmentDetail    from "../components/CommitmentDetail";
import JudgingScreen       from "../components/JudgingScreen";
import ProfileScreen       from "../components/ProfileScreen";
import ExploreScreen       from "../components/ExploreScreen";
import ImportKeyScreen     from "../components/ImportKeyScreen";
import BottomNav           from "../components/BottomNav";

const POLL_INTERVAL = 3000;

// ── Deadline helpers ────────────────────────────────────────────
function addHours(dateStr: string, hours: number): string {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + hours);
  // Return full ISO string so time component is preserved
  return d.toISOString();
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function App() {
  // ── UI state ───────────────────────────────────────────────────
  const [screen, setScreen]               = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress] = useState("");
  const [playerName, setPlayerName]       = useState("");

  // ── Active data ────────────────────────────────────────────────
  const [activeCommitmentId, setActiveCommitmentId] = useState("");
  const [commitment, setCommitment]   = useState<Commitment | null>(null);
  const [myCommitments, setMyCommitments] = useState<Commitment[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [recentCommitments, setRecentCommitments] = useState<Commitment[]>([]);

  // ── Feedback ───────────────────────────────────────────────────
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState("");

  // ── Refs ────────────────────────────────────────────────────────
  const accountRef          = useRef<ReturnType<typeof makeAccount> | null>(null);
  const screenRef           = useRef<Screen>("landing");
  const pollTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCommitmentIdRef = useRef<string>("");
  const calculatingRef      = useRef(false);

  // Keep screenRef in sync so the polling closure reads the current screen
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ── Account initialisation ─────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem("cc_name");
    let acc: ReturnType<typeof makeAccount>;
    const savedKey = localStorage.getItem("cc_private_key");

    try {
      if (
        savedKey &&
        savedKey !== "undefined" &&
        savedKey !== "null" &&
        savedKey.startsWith("0x")
      ) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        if (savedKey !== null) {
          localStorage.removeItem("cc_private_key");
          localStorage.removeItem("cc_address");
        }
        acc = makeAccount();
        localStorage.setItem("cc_private_key", acc.privateKey);
      }
    } catch {
      // Bad saved key — clear everything and start fresh
      localStorage.removeItem("cc_private_key");
      localStorage.removeItem("cc_address");
      localStorage.removeItem("cc_name");
      acc = makeAccount();
      localStorage.setItem("cc_private_key", acc.privateKey);
    }

    accountRef.current = acc;
    localStorage.setItem("cc_address", acc.address);
    setPlayerAddress(acc.address);
    if (savedName) setPlayerName(savedName);
  }, []);

  // ── Account helper (lazy re-init safety) ──────────────────────
  function getAccount(): ReturnType<typeof makeAccount> {
    if (!accountRef.current) {
      const savedKey = localStorage.getItem("cc_private_key");
      try {
        if (
          savedKey &&
          savedKey !== "undefined" &&
          savedKey !== "null" &&
          savedKey.startsWith("0x")
        ) {
          accountRef.current = makeAccount(savedKey as `0x${string}`);
        } else {
          accountRef.current = makeAccount();
          localStorage.setItem("cc_private_key", accountRef.current.privateKey);
        }
      } catch {
        localStorage.removeItem("cc_private_key");
        accountRef.current = makeAccount();
        localStorage.setItem("cc_private_key", accountRef.current.privateKey);
      }
      localStorage.setItem("cc_address", accountRef.current.address);
      setPlayerAddress(accountRef.current.address);
    }
    return accountRef.current;
  }

  // ── Navigation helper ──────────────────────────────────────────
  function navigate(s: Screen) {
    screenRef.current = s;
    setError("");
    setScreen(s);
  }

  // ── Polling ─────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (commitmentId: string) => {
      stopPolling();
      pollCommitmentIdRef.current = commitmentId;

      const poll = async () => {
        if (screenRef.current !== "judging") return;
        if (!pollCommitmentIdRef.current) return;

        try {
          const data = await getCommitment(pollCommitmentIdRef.current);
          if (!data || data.error) return;

          setCommitment(data);

          // AI finished — stop polling and show the result
          if (data.status === "resolved") {
            stopPolling();
            calculatingRef.current = false;
            navigate("commitment_detail");
          }
        } catch {
          // Network blip — keep polling
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Name helper ────────────────────────────────────────────────
  function handleSetName(name: string) {
    setPlayerName(name);
    localStorage.setItem("cc_name", name);
  }

  // ── Import key ─────────────────────────────────────────────────
  function handleImportKey(privateKey: string) {
    const trimmed = privateKey.trim();
    if (!trimmed.startsWith("0x")) {
      setError("Private key must start with 0x");
      return;
    }
    try {
      const acc = makeAccount(trimmed as `0x${string}`);
      accountRef.current = acc;
      localStorage.setItem("cc_private_key", acc.privateKey);
      localStorage.setItem("cc_address", acc.address);
      setPlayerAddress(acc.address);
      // Reset cached data — different address
      setMyCommitments([]);
      setProfile(null);
      setError("");
      navigate("landing");
    } catch {
      setError("Invalid private key. Check it and try again.");
    }
  }

  // ── Create commitment ──────────────────────────────────────────
  async function handleCreateCommitment(params: {
    goalText: string;
    criteriaText: string;
    category: Category;
    commitmentDeadline: string;
  }) {
    setLoading("Locking commitment...");
    setError("");
    const acc = getAccount();

    // Calculate proof_deadline = commitment_deadline + 48h
    const proofDeadline = addHours(params.commitmentDeadline + "T23:59:59", 48);

    try {
      const commitmentId = await createCommitment(
        acc,
        acc.address,
        playerName || "Anonymous",
        params.goalText,
        params.criteriaText,
        params.category,
        params.commitmentDeadline,
        proofDeadline
      );

      if (!commitmentId) {
        throw new Error(
          "Commitment not created — you may already have 5 open commitments."
        );
      }

      // Load the new commitment and show detail
      const data = await getCommitment(commitmentId);
      setCommitment(data);
      setActiveCommitmentId(commitmentId);

      // Refresh my list in background
      getMyCommitments(acc.address)
        .then(setMyCommitments)
        .catch(() => {});

      navigate("commitment_detail");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to create commitment. Try again.");
      navigate("create_commitment");
    } finally {
      setLoading("");
    }
  }

  // ── Submit proof + evaluate (the AI trigger) ───────────────────
  async function handleSubmitProof(params: {
    proofText: string;
    proofLink: string;
  }) {
    if (!activeCommitmentId) return;
    setLoading("Submitting proof...");
    setError("");
    const acc = getAccount();

    try {
      // Step 1 — submit_proof: fast state change to "evaluating"
      await submitProof(
        acc,
        activeCommitmentId,
        acc.address,
        params.proofText,
        params.proofLink
      );

      // Step 2 — show judging screen immediately
      const data = await getCommitment(activeCommitmentId);
      setCommitment(data);
      setLoading("");
      navigate("judging");

      // Step 3 — fire evaluate_commitment (the 3-5 min AI call)
      if (!calculatingRef.current) {
        calculatingRef.current = true;
        evaluateCommitment(acc, activeCommitmentId).catch(() => {
          // evaluate fired — polling will catch the resolved state
          calculatingRef.current = false;
        });
      }

      // Step 4 — start polling for the result
      startPolling(activeCommitmentId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to submit proof. Try again.");
      setLoading("");
      navigate("submit_proof");
    }
  }

  // ── Check expired ──────────────────────────────────────────────
  async function handleCheckExpired(commitmentId: string) {
    setLoading("Marking as expired...");
    setError("");
    const acc = getAccount();
    try {
      await checkExpired(acc, commitmentId);
      // Reload the commitment
      const data = await getCommitment(commitmentId);
      setCommitment(data);
      if (activeCommitmentId === commitmentId) {
        setCommitment(data);
      }
      // Refresh lists
      getMyCommitments(acc.address).then(setMyCommitments).catch(() => {});
    } catch (e: any) {
      console.error(e);
      setError("Failed to mark expired. Try again.");
    } finally {
      setLoading("");
    }
  }

  // ── Load helpers ───────────────────────────────────────────────
  async function handleLoadMyCommitments() {
    const acc = getAccount();
    setLoading("Loading your commitments...");
    try {
      const data = await getMyCommitments(acc.address);
      setMyCommitments(data || []);
    } catch {
      setError("Could not load commitments.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadProfile(address?: string) {
    const addr = address || playerAddress || getAccount().address;
    setLoading("Loading profile...");
    try {
      const data = await getProfile(addr);
      setProfile(data);
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadRecent() {
    try {
      const data = await getRecentCommitments(20);
      setRecentCommitments(data || []);
    } catch {
      // Silent — landing screen shows empty state
    }
  }

  async function handleLoadCommitment(id: string) {
    setLoading("Loading commitment...");
    setError("");
    try {
      const data = await getCommitment(id);
      if (data.error) throw new Error("Not found");
      setCommitment(data);
      setActiveCommitmentId(id);
      navigate("commitment_detail");
    } catch {
      setError("Commitment not found.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadByCategory(category: string) {
    setLoading("Loading...");
    try {
      const data = await getCommitmentsByCategory(category, 20);
      setRecentCommitments(data || []);
    } catch {
      setError("Could not load commitments.");
    } finally {
      setLoading("");
    }
  }

  // ── Navigate to submit proof ───────────────────────────────────
  function handleGoToSubmitProof(c: Commitment) {
    setCommitment(c);
    setActiveCommitmentId(c.id);
    navigate("submit_proof");
  }

  // ── Select a commitment from a list ───────────────────────────
  function handleSelectCommitment(c: Commitment) {
    setCommitment(c);
    setActiveCommitmentId(c.id);
    navigate("commitment_detail");
  }

  // ── Whether to show bottom nav ─────────────────────────────────
  const mainScreens: Screen[] = ["landing", "my_commitments", "explore", "profile"];
  const showBottomNav = mainScreens.includes(screen);

  // ── Screen renderer ────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return (
          <LandingScreen
            playerAddress={playerAddress}
            playerName={playerName}
            profile={profile}
            recentCommitments={recentCommitments}
            onSetName={handleSetName}
            onNavigate={navigate}
            onLoadRecent={handleLoadRecent}
            onLoadProfile={() => handleLoadProfile()}
            onSelectCommitment={handleSelectCommitment}
            onCheckExpired={handleCheckExpired}
            loading={loading}
            error={error}
          />
        );

      case "create_commitment":
        return (
          <CreateCommitmentScreen
            playerName={playerName}
            onSubmit={handleCreateCommitment}
            onBack={() => navigate("landing")}
            loading={loading}
            error={error}
          />
        );

      case "my_commitments":
        return (
          <MyCommitmentsScreen
            myCommitments={myCommitments}
            playerAddress={playerAddress}
            onLoad={handleLoadMyCommitments}
            onSelectCommitment={handleSelectCommitment}
            onGoToSubmitProof={handleGoToSubmitProof}
            onCheckExpired={handleCheckExpired}
            onNavigate={navigate}
            loading={loading}
            error={error}
          />
        );

      case "submit_proof":
        if (!commitment) return null;
        return (
          <SubmitProofScreen
            commitment={commitment}
            onSubmit={handleSubmitProof}
            onBack={() => navigate("commitment_detail")}
            loading={loading}
            error={error}
          />
        );

      case "commitment_detail":
        if (!commitment) return null;
        return (
          <CommitmentDetail
            commitment={commitment}
            playerAddress={playerAddress}
            onGoToSubmitProof={() => handleGoToSubmitProof(commitment)}
            onCheckExpired={() => handleCheckExpired(commitment.id)}
            onBack={() => {
              // Go back to wherever makes sense
              const prev = myCommitments.find((c) => c.id === commitment.id)
                ? "my_commitments"
                : "landing";
              navigate(prev);
            }}
            onRefresh={() => handleLoadCommitment(commitment.id)}
            loading={loading}
            error={error}
          />
        );

      case "judging":
        return (
          <JudgingScreen
            commitmentId={activeCommitmentId}
            commitment={commitment}
            onGoHome={() => {
              stopPolling();
              calculatingRef.current = false;
              navigate("landing");
            }}
            onViewMine={() => {
              stopPolling();
              calculatingRef.current = false;
              handleLoadMyCommitments().then(() => navigate("my_commitments"));
            }}
          />
        );

      case "profile":
        return (
          <ProfileScreen
            playerAddress={playerAddress}
            playerName={playerName}
            profile={profile}
            onLoad={() => handleLoadProfile()}
            onSelectCommitment={handleSelectCommitment}
            onNavigate={navigate}
            myCommitments={myCommitments}
            onLoadMyCommitments={handleLoadMyCommitments}
            loading={loading}
            error={error}
          />
        );

      case "explore":
        return (
          <ExploreScreen
            recentCommitments={recentCommitments}
            onLoadRecent={handleLoadRecent}
            onLoadByCategory={handleLoadByCategory}
            onSelectCommitment={handleSelectCommitment}
            onCheckExpired={handleCheckExpired}
            loading={loading}
            error={error}
          />
        );

      case "import_key":
        return (
          <ImportKeyScreen
            onImport={handleImportKey}
            onBack={() => navigate("landing")}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <main className="app-root">
      <div className="app-container">
        {renderScreen()}
        {showBottomNav && (
          <BottomNav
            activeScreen={screen}
            onNavigate={(s) => {
              // Lazy-load data on first visit to each tab
              if (s === "my_commitments" && myCommitments.length === 0) {
                handleLoadMyCommitments();
              }
              if (s === "explore" && recentCommitments.length === 0) {
                handleLoadRecent();
              }
              if (s === "profile" && !profile) {
                handleLoadProfile();
              }
              navigate(s);
            }}
          />
        )}
      </div>
    </main>
  );
}
