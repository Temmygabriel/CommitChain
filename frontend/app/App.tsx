"use client";
// CommitChain — Main Orchestrator
// Updated: submitProof no longer passes owner_address (authenticated on-chain)

import { useState, useEffect, useRef, useCallback } from "react";
import { Screen, Commitment, Profile, Category, isExpired } from "../types";
import {
  makeAccount, createCommitment, submitProof,
  evaluateCommitment, checkExpired, getCommitment,
  getMyCommitments, getProfile, getRecentCommitments,
  getCommitmentsByCategory,
} from "../lib/contract";

import Sidebar              from "../components/Sidebar";
import BottomNav            from "../components/BottomNav";
import LandingScreen        from "../components/LandingScreen";
import CreateCommitmentScreen from "../components/CreateCommitmentScreen";
import MyCommitmentsScreen  from "../components/MyCommitmentsScreen";
import SubmitProofScreen    from "../components/SubmitProofScreen";
import CommitmentDetail     from "../components/CommitmentDetail";
import JudgingScreen        from "../components/JudgingScreen";
import ProfileScreen        from "../components/ProfileScreen";
import ExploreScreen        from "../components/ExploreScreen";
import ImportKeyScreen      from "../components/ImportKeyScreen";

const POLL_INTERVAL = 3000;

function addHours(dateStr: string, hours: number): string {
  const d = new Date(dateStr + "T23:59:59");
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const MAIN_SCREENS: Screen[] = ["landing", "my_commitments", "explore", "profile"];

export default function App() {
  const [screen, setScreen]               = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress] = useState("");
  const [playerName, setPlayerName]       = useState("");
  const [activeCommitmentId, setActiveCommitmentId] = useState("");
  const [commitment, setCommitment]       = useState<Commitment | null>(null);
  const [myCommitments, setMyCommitments] = useState<Commitment[]>([]);
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [recentCommitments, setRecentCommitments] = useState<Commitment[]>([]);
  const [error, setError]                 = useState("");
  const [loading, setLoading]             = useState("");

  const accountRef          = useRef<ReturnType<typeof makeAccount> | null>(null);
  const screenRef           = useRef<Screen>("landing");
  const pollTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCommitmentIdRef = useRef<string>("");
  const calculatingRef      = useRef(false);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ── Account init ────────────────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem("cc_name");
    let acc: ReturnType<typeof makeAccount>;
    const savedKey  = localStorage.getItem("cc_private_key");
    try {
      if (savedKey && savedKey !== "undefined" && savedKey !== "null" && savedKey.startsWith("0x")) {
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

  function getAccount(): ReturnType<typeof makeAccount> {
    if (!accountRef.current) {
      const savedKey = localStorage.getItem("cc_private_key");
      try {
        if (savedKey && savedKey !== "undefined" && savedKey !== "null" && savedKey.startsWith("0x")) {
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

  function navigate(s: Screen) {
    screenRef.current = s;
    setError("");
    setScreen(s);
  }

  // ── Polling ──────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  const startPolling = useCallback((commitmentId: string) => {
    stopPolling();
    pollCommitmentIdRef.current = commitmentId;
    const poll = async () => {
      if (screenRef.current !== "judging") return;
      if (!pollCommitmentIdRef.current) return;
      try {
        const data = await getCommitment(pollCommitmentIdRef.current);
        if (!data || data.error) return;
        setCommitment(data);
        if (data.status === "resolved") {
          stopPolling();
          calculatingRef.current = false;
          navigate("commitment_detail");
        }
      } catch {}
    };
    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Helpers ──────────────────────────────────────────────────────
  function handleSetName(name: string) {
    setPlayerName(name);
    localStorage.setItem("cc_name", name);
  }

  function handleImportKey(privateKey: string) {
    const trimmed = privateKey.trim();
    if (!trimmed.startsWith("0x")) { setError("Private key must start with 0x"); return; }
    try {
      const acc = makeAccount(trimmed as `0x${string}`);
      accountRef.current = acc;
      localStorage.setItem("cc_private_key", acc.privateKey);
      localStorage.setItem("cc_address", acc.address);
      setPlayerAddress(acc.address);
      setMyCommitments([]);
      setProfile(null);
      setError("");
      navigate("landing");
    } catch {
      setError("Invalid private key. Check it and try again.");
    }
  }

  // ── Create commitment ────────────────────────────────────────────
  async function handleCreateCommitment(params: { goalText: string; criteriaText: string; category: Category; commitmentDeadline: string; }) {
    setLoading("Locking commitment…");
    setError("");
    const acc = getAccount();
    const proofDeadline = addHours(params.commitmentDeadline, 48);
    try {
      const id = await createCommitment(
        acc,
        acc.address,
        playerName || "Anonymous",
        params.goalText,
        params.criteriaText,
        params.category,
        params.commitmentDeadline,
        proofDeadline
      );
      if (!id) throw new Error("Commitment not created — you may already have 5 open commitments.");
      const data = await getCommitment(id);
      setCommitment(data);
      setActiveCommitmentId(id);
      getMyCommitments(acc.address).then(setMyCommitments).catch(() => {});
      navigate("commitment_detail");
    } catch (e: any) {
      setError(e.message || "Failed to create commitment. Try again.");
      navigate("create_commitment");
    } finally {
      setLoading("");
    }
  }

  // ── Submit proof ─────────────────────────────────────────────────
  // CHANGED: owner_address is no longer passed to submitProof.
  // The contract authenticates the tx sender on-chain via gl.message.sender_address.
  // If the proof is submitted outside the allowed window (after commitment deadline,
  // before proof deadline closes) the contract silently returns and no state change
  // occurs. The frontend re-fetches to detect this and shows an appropriate error.
  async function handleSubmitProof(params: { proofText: string; proofLink: string; }) {
    if (!activeCommitmentId) return;
    setLoading("Submitting proof…");
    setError("");
    const acc = getAccount();
    try {
      await submitProof(acc, activeCommitmentId, params.proofText, params.proofLink);

      // Re-fetch to verify the contract actually accepted the submission.
      // If the contract silently rejected it (wrong sender, deadline not met),
      // status will still be "committed" — we surface a clear error.
      const data = await getCommitment(activeCommitmentId);
      setCommitment(data);

      if (data.status !== "evaluating") {
        // Contract rejected the submission. Most likely causes:
        // 1. Commitment deadline hasn't passed yet (too early to submit proof)
        // 2. Proof window has already closed (too late)
        // 3. Transaction signed by a different key than the owner
        const today = new Date().toISOString().split("T")[0];
        const commitDeadline = data.commitment_deadline;
        const proofDeadline = data.proof_deadline?.split("T")[0] ?? "";

        let reason = "Proof submission was rejected by the contract.";
        if (today <= commitDeadline) {
          reason = "Your commitment deadline hasn't passed yet. You can only submit proof after your deadline date.";
        } else if (proofDeadline && today > proofDeadline) {
          reason = "The 48-hour proof window has closed. This commitment will be marked BROKEN.";
        }

        setError(reason);
        setLoading("");
        navigate("submit_proof");
        return;
      }

      setLoading("");
      navigate("judging");
      if (!calculatingRef.current) {
        calculatingRef.current = true;
        evaluateCommitment(acc, activeCommitmentId).catch(() => { calculatingRef.current = false; });
      }
      startPolling(activeCommitmentId);
    } catch (e: any) {
      setError(e.message || "Failed to submit proof. Try again.");
      setLoading("");
      navigate("submit_proof");
    }
  }

  async function handleCheckExpired(commitmentId: string) {
    setLoading("Marking expired…");
    setError("");
    const acc = getAccount();
    try {
      await checkExpired(acc, commitmentId);
      // Re-fetch and check — contract silently rejects if deadline hasn't passed
      const data = await getCommitment(commitmentId);
      setCommitment(data);

      if (data.status !== "resolved") {
        setError("Cannot mark as expired yet — the proof window hasn't closed.");
        setLoading("");
        return;
      }

      getMyCommitments(acc.address).then(setMyCommitments).catch(() => {});
    } catch {
      setError("Failed to mark expired. Try again.");
    } finally { setLoading(""); }
  }

  async function handleLoadMyCommitments() {
    const acc = getAccount();
    setLoading("Loading…");
    try {
      const data = await getMyCommitments(acc.address);
      setMyCommitments(data || []);
    } catch { setError("Could not load commitments."); }
    finally { setLoading(""); }
  }

  async function handleLoadProfile(address?: string, silent = false) {
    const addr = address || playerAddress;
    if (!addr) return;
    if (!silent) setLoading("Loading profile…");
    try {
      const data = await getProfile(addr);
      if (data && !data.error) setProfile(data);
    } catch {
      if (!silent) setError("Could not load profile.");
    } finally {
      if (!silent) setLoading("");
    }
  }

  async function handleLoadRecent() {
    try { const data = await getRecentCommitments(20); setRecentCommitments(data || []); } catch {}
  }

  async function handleLoadCommitment(id: string) {
    setLoading("Loading…");
    setError("");
    try {
      const data = await getCommitment(id);
      if (data.error) throw new Error("Not found");
      setCommitment(data);
      setActiveCommitmentId(id);
      navigate("commitment_detail");
    } catch { setError("Commitment not found."); }
    finally { setLoading(""); }
  }

  async function handleLoadByCategory(category: string) {
    setLoading("Loading…");
    try { const data = await getCommitmentsByCategory(category, 20); setRecentCommitments(data || []); }
    catch { setError("Could not load commitments."); }
    finally { setLoading(""); }
  }

  function handleGoToSubmitProof(c: Commitment) {
    setCommitment(c); setActiveCommitmentId(c.id); navigate("submit_proof");
  }

  function handleSelectCommitment(c: Commitment) {
    setCommitment(c); setActiveCommitmentId(c.id); navigate("commitment_detail");
  }

  // ── Screen renderer ──────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return <LandingScreen playerAddress={playerAddress} playerName={playerName} profile={profile} recentCommitments={recentCommitments} onSetName={handleSetName} onNavigate={navigate} onLoadRecent={handleLoadRecent} onLoadProfile={() => handleLoadProfile(undefined, true)} onSelectCommitment={handleSelectCommitment} onCheckExpired={handleCheckExpired} loading={loading} error={error} />;
      case "create_commitment":
        return <CreateCommitmentScreen playerName={playerName} onSubmit={handleCreateCommitment} onBack={() => navigate("landing")} loading={loading} error={error} />;
      case "my_commitments":
        return <MyCommitmentsScreen myCommitments={myCommitments} playerAddress={playerAddress} onLoad={handleLoadMyCommitments} onSelectCommitment={handleSelectCommitment} onGoToSubmitProof={handleGoToSubmitProof} onCheckExpired={handleCheckExpired} onNavigate={navigate} loading={loading} error={error} />;
      case "submit_proof":
        if (!commitment) return null;
        return <SubmitProofScreen commitment={commitment} onSubmit={handleSubmitProof} onBack={() => navigate("commitment_detail")} loading={loading} error={error} />;
      case "commitment_detail":
        if (!commitment) return null;
        return <CommitmentDetail commitment={commitment} playerAddress={playerAddress} onGoToSubmitProof={() => handleGoToSubmitProof(commitment)} onCheckExpired={() => handleCheckExpired(commitment.id)} onBack={() => navigate(myCommitments.find(c => c.id === commitment.id) ? "my_commitments" : "landing")} onRefresh={() => handleLoadCommitment(commitment.id)} loading={loading} error={error} />;
      case "judging":
        return <JudgingScreen commitmentId={activeCommitmentId} commitment={commitment} onGoHome={() => { stopPolling(); calculatingRef.current = false; navigate("landing"); }} onViewMine={() => { stopPolling(); calculatingRef.current = false; handleLoadMyCommitments().then(() => navigate("my_commitments")); }} />;
      case "profile":
        return <ProfileScreen playerAddress={playerAddress} playerName={playerName} profile={profile} myCommitments={myCommitments} onLoad={() => handleLoadProfile()} onLoadMyCommitments={handleLoadMyCommitments} onSelectCommitment={handleSelectCommitment} onNavigate={navigate} loading={loading} error={error} />;
      case "explore":
        return <ExploreScreen recentCommitments={recentCommitments} onLoadRecent={handleLoadRecent} onLoadByCategory={handleLoadByCategory} onSelectCommitment={handleSelectCommitment} onCheckExpired={handleCheckExpired} loading={loading} error={error} />;
      case "import_key":
        return <ImportKeyScreen onImport={handleImportKey} onBack={() => navigate("landing")} error={error} />;
      default:
        return null;
    }
  };

  const showNav = MAIN_SCREENS.includes(screen);

  return (
    <div className="app-root">
      <div className="app-layout">
        <Sidebar activeScreen={screen} playerAddress={playerAddress} playerName={playerName}
          onNavigate={(s) => {
            if (s === "my_commitments" && myCommitments.length === 0) handleLoadMyCommitments();
            if (s === "explore" && recentCommitments.length === 0) handleLoadRecent();
            if (s === "profile" && !profile) handleLoadProfile();
            navigate(s);
          }}
        />
        <main className="main-content">
          <div className="page">
            {renderScreen()}
          </div>
        </main>
        {showNav && (
          <BottomNav activeScreen={screen} onNavigate={(s) => {
            if (s === "my_commitments" && myCommitments.length === 0) handleLoadMyCommitments();
            if (s === "explore" && recentCommitments.length === 0) handleLoadRecent();
            if (s === "profile" && !profile) handleLoadProfile();
            navigate(s);
          }} />
        )}
      </div>
    </div>
  );
}
