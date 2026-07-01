// CommitChain — GenLayer Contract Utils
// Session 3

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { Commitment, Profile } from "../types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

function makeClient(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, account });
}

export function makeAccount(privateKey?: `0x${string}`) {
  return createAccount(privateKey);
}

// ── Core write — for methods that return nothing ────────────────
export async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`[cc] writeContract attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`[cc] writeContract success: ${method}`);
      return;
    } catch (err: any) {
      console.error(`[cc] writeContract ${method} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
}

// ── Core write with return — for create_commitment ──────────────
export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`[cc] writeContractWithReturn attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
      // simulateWriteContract gets the return value (commitment ID)
      const returnValue = await client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
      });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`[cc] writeContractWithReturn success: ${method}, returned:`, returnValue);
      return returnValue as string;
    } catch (err: any) {
      console.error(`[cc] writeContractWithReturn ${method} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// ── Core read — free, instant ───────────────────────────────────
export async function readContract(method: string, args: unknown[]): Promise<string> {
  const account = createAccount();
  const client = makeClient(account);
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result as string;
}

// ── CommitChain-specific write wrappers ─────────────────────────

export async function createCommitment(
  account: ReturnType<typeof createAccount>,
  ownerAddress: string,
  ownerName: string,
  goalText: string,
  criteriaText: string,
  category: string,
  commitmentDeadline: string,
  proofDeadline: string
): Promise<string> {
  return writeContractWithReturn(account, "create_commitment", [
    ownerAddress,
    ownerName,
    goalText,
    criteriaText,
    category,
    commitmentDeadline,
    proofDeadline,
  ]);
}

export async function submitProof(
  account: ReturnType<typeof createAccount>,
  commitmentId: string,
  ownerAddress: string,
  proofText: string,
  proofLink: string
): Promise<void> {
  return writeContract(account, "submit_proof", [
    commitmentId,
    ownerAddress,
    proofText,
    proofLink,
  ]);
}

export async function evaluateCommitment(
  account: ReturnType<typeof createAccount>,
  commitmentId: string
): Promise<void> {
  return writeContract(account, "evaluate_commitment", [commitmentId]);
}

export async function checkExpired(
  account: ReturnType<typeof createAccount>,
  commitmentId: string
): Promise<void> {
  return writeContract(account, "check_expired", [commitmentId]);
}

// ── CommitChain-specific read wrappers ──────────────────────────

export async function getCommitment(commitmentId: string): Promise<Commitment> {
  const raw = await readContract("get_commitment", [commitmentId]);
  return JSON.parse(raw);
}

export async function getMyCommitments(address: string): Promise<Commitment[]> {
  const raw = await readContract("get_my_commitments", [address]);
  return JSON.parse(raw);
}

export async function getProfile(address: string): Promise<Profile> {
  const raw = await readContract("get_profile", [address]);
  return JSON.parse(raw);
}

export async function getRecentCommitments(limit: number): Promise<Commitment[]> {
  const raw = await readContract("get_recent_commitments", [limit]);
  return JSON.parse(raw);
}

export async function getCommitmentsByCategory(
  category: string,
  limit: number
): Promise<Commitment[]> {
  const raw = await readContract("get_commitments_by_category", [category, limit]);
  return JSON.parse(raw);
}
