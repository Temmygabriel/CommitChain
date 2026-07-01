// CommitChain — Shared Types

export type Screen =
  | "landing"
  | "create_commitment"
  | "my_commitments"
  | "submit_proof"
  | "commitment_detail"
  | "judging"
  | "profile"
  | "explore"
  | "import_key";

export type CommitmentStatus = "committed" | "evaluating" | "resolved";
export type Verdict = "KEPT" | "BROKEN" | "PARTIAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Category = "fitness" | "work" | "habit" | "learning" | "other";

export interface Commitment {
  id: string;
  owner_address: string;
  owner_name: string;
  goal_text: string;
  criteria_text: string;
  category: Category;
  commitment_deadline: string;
  proof_deadline: string;
  status: CommitmentStatus;
  proof_text: string | null;
  proof_link: string | null;
  verdict: Verdict | null;
  reasoning: string | null;
  confidence: Confidence | null;
  created_at: number;
  error?: string;
}

export interface Profile {
  address: string;
  kept_count: number;
  broken_count: number;
  partial_count: number;
  total_resolved: number;
  total_commitments: number;
  current_streak: number;
  longest_streak: number;
  error?: string;
}

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "fitness",  label: "Fitness",  icon: "🏃" },
  { value: "work",     label: "Work",     icon: "💼" },
  { value: "habit",    label: "Habit",    icon: "🔄" },
  { value: "learning", label: "Learning", icon: "📚" },
  { value: "other",    label: "Other",    icon: "✦"  },
];

export function getCategoryIcon(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.icon ?? "✦";
}

export function getCategoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function isExpired(proofDeadline: string): boolean {
  try {
    return new Date(proofDeadline) < new Date();
  } catch {
    return false;
  }
}

export function formatDeadline(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string): number {
  try {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}
