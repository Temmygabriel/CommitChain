# CommitChain

On-chain personal accountability. Lock what you commit to before you're tempted to change it. AI judges whether you kept your word. Your record is permanent.

---

## The problem

Every accountability app has the same weakness: someone controls the database. The app can quietly delete your streak. You can edit your goal after failing it. The "judge" is you grading your own homework.

CommitChain removes that. Your commitment text is locked on GenLayer the moment you submit it. The success criteria you write today — before the deadline, before the excuses — is what the AI reads when your deadline arrives. You can't touch it.

---

## How it works

1. **Write your commitment** — goal text, specific success criteria, a deadline. Locked on-chain immediately.
2. **Wait** — the commitment sits there, public and unchangeable.
3. **Submit proof** — when your deadline passes, you have 48 hours to describe what happened.
4. **AI rules** — a GenLayer intelligent contract compares your original criteria against your proof. Verdict: `KEPT`, `BROKEN`, or `PARTIAL`.
5. **Record is permanent** — the verdict can't be edited, deleted, or appealed.

---

## What makes this different

Normal blockchain apps are deterministic — every validator runs the same code and gets the same result. GenLayer breaks that constraint. The contract calls an LLM and uses an equivalence principle to reach consensus across validators on whether the proof meets the criteria. No single validator controls the verdict.

No funds are held anywhere. No balances, no payouts, no treasury. The contract stores commitment text and AI verdicts only. There's nothing to drain and no spoofed identity that moves money.

---

## Stack

| Layer | Tech |
|---|---|
| Intelligent contract | Python on GenLayer studionet |
| Frontend | Next.js 15, React 19 |
| Blockchain client | genlayer-js 0.23.0 |
| Styling | Space Grotesk, Playfair Display, custom CSS |
| Deployment | Vercel |

---

## Contract

`Contracts/commitchain.py` — one intelligent contract with five write methods and four view methods.

**Write methods:**
- `create_commitment` — locks goal, criteria, deadlines on-chain. Returns commitment ID (e.g. `CMT000001`). Max 5 open commitments per address.
- `submit_proof` — owner submits proof text + optional link before the proof deadline.
- `evaluate_commitment` — fires the AI call. Compares criteria vs proof. Returns `KEPT`, `BROKEN`, or `PARTIAL` with reasoning and confidence level.
- `check_expired` — anyone can call this once the proof window closes with no submission. Resolves to `BROKEN` automatically. No AI call needed.
- `finalize_game` — required stub per GenLayer pattern.

**View methods:**
- `get_commitment` — fetch a single commitment by ID
- `get_my_commitments` — all commitments for an address, newest first
- `get_profile` — computed live from full history: kept/broken/partial counts, current streak, longest streak
- `get_recent_commitments` — public feed for the explore screen
- `get_commitments_by_category` — filtered feed by category

Profile stats are computed on read from the full commitment history — never stored as mutable counters. This eliminates an entire class of sync bugs.

---

## Streak rules

- `KEPT` adds +1 to current streak
- `BROKEN` resets current streak to 0
- `PARTIAL` is neutral — streak neither grows nor resets

Longest streak is preserved permanently even after a broken run.

---

## Running locally

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Add your contract address to .env.local
npm run dev
```

One environment variable required:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

Get this from GenLayer Studio after deploying `Contracts/commitchain.py` to studionet.

---

## Deploying the contract

1. Open [studio.genlayer.com](https://studio.genlayer.com)
2. Create a new contract and paste `Contracts/commitchain.py`
3. Deploy to studionet
4. Copy the contract address into your Vercel environment variables

---

## Identity

No wallet connection required. The app generates a private key on first visit and saves it to localStorage. Your address is your permanent identity across sessions on the same device.

To use the same identity on another device: Profile → Reveal Private Key → copy it → new device → Import Key.

---

## Category caps

Max 5 open commitments per address at any time. "Open" means status is `committed` or `evaluating`. Once resolved, the slot frees up.

---

## Built on

[GenLayer](https://genlayer.com) — the blockchain that lets smart contracts call an LLM and reach consensus on non-deterministic results.
