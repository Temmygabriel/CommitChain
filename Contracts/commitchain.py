# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer.gl as gl
from genlayer import TreeMap, u256
import json


class CommitChain(gl.Contract):

    commitment_count: u256
    commitments: TreeMap[str, str]         # commitment_id → JSON
    member_commitments: TreeMap[str, str]  # address → [commitment_ids] JSON
    recent_ids: TreeMap[u256, str]         # counter index → commitment_id

    def __init__(self):
        self.commitment_count = u256(0)

    # ----------------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------------

    def _make_commitment_id(self) -> str:
        self.commitment_count = u256(int(self.commitment_count) + 1)
        n = int(self.commitment_count)
        return "CMT" + str(n).zfill(6)

    def _read_commitment(self, commitment_id: str) -> dict:
        return json.loads(self.commitments[commitment_id])

    def _write_commitment(self, commitment_id: str, data: dict) -> None:
        self.commitments[commitment_id] = json.dumps(data)

    def _get_member_commitments(self, address: str) -> list:
        raw = self.member_commitments.get(address)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_member_commitments(self, address: str, ids: list) -> None:
        self.member_commitments[address] = json.dumps(ids)

    def _count_open_commitments(self, address: str) -> int:
        """Count commitments in committed or evaluating state — for the max-5 cap."""
        ids = self._get_member_commitments(address)
        count = 0
        for cid in ids:
            raw = self.commitments.get(cid)
            if raw is not None:
                c = json.loads(raw)
                if c["status"] in ("committed", "evaluating"):
                    count += 1
        return count

    def _compute_profile(self, address: str) -> dict:
        """
        Compute profile stats on read from the full commitment history.
        Never stored as mutable state — impossible to get out of sync.

        Streak rules:
        - KEPT   → current_streak += 1, update longest if exceeded
        - BROKEN → current_streak resets to 0
        - PARTIAL → no change to streak either way (neutral)
        """
        ids = self._get_member_commitments(address)

        kept = 0
        broken = 0
        partial = 0

        resolved = []
        for cid in ids:
            raw = self.commitments.get(cid)
            if raw is not None:
                c = json.loads(raw)
                if c["status"] == "resolved":
                    resolved.append(c)

        # Sort oldest-first so streak walks forward through time
        resolved.sort(key=lambda x: x["created_at"])

        temp_streak = 0
        longest_streak = 0

        for c in resolved:
            v = c.get("verdict", "")
            if v == "KEPT":
                kept += 1
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            elif v == "BROKEN":
                broken += 1
                temp_streak = 0
            elif v == "PARTIAL":
                partial += 1
                # PARTIAL is neutral — streak neither grows nor resets

        return {
            "address": address,
            "kept_count": kept,
            "broken_count": broken,
            "partial_count": partial,
            "total_resolved": len(resolved),
            "total_commitments": len(ids),
            "current_streak": temp_streak,
            "longest_streak": longest_streak,
        }

    # ----------------------------------------------------------------
    # Public write methods
    # ----------------------------------------------------------------

    @gl.public.write
    def create_commitment(
        self,
        owner_address: str,
        owner_name: str,
        goal_text: str,
        criteria_text: str,
        category: str,
        commitment_deadline: str,
        proof_deadline: str,
    ) -> str:
        """
        Lock a new commitment on-chain.

        commitment_deadline — human-readable string the user sets ("2026-07-15").
                              Stored immutably. Frontend drives deadline UX.
        proof_deadline      — 48h window after commitment_deadline, also stored
                              as a string. Frontend uses this to know when to
                              offer the "check_expired" button to anyone.

        Returns the commitment_id (e.g. "CMT000001") or "" if capped.
        """
        # Hard cap: max 5 open commitments per address at any time
        if self._count_open_commitments(owner_address) >= 5:
            return ""

        # Validate non-empty required fields
        if not goal_text.strip():
            return ""
        if not criteria_text.strip():
            return ""

        commitment_id = self._make_commitment_id()

        commitment = {
            "id": commitment_id,
            "owner_address": owner_address,
            "owner_name": owner_name,
            "goal_text": goal_text,
            "criteria_text": criteria_text,
            "category": category,
            "commitment_deadline": commitment_deadline,
            "proof_deadline": proof_deadline,
            "status": "committed",
            "proof_text": None,
            "proof_link": None,
            "verdict": None,
            "reasoning": None,
            "confidence": None,
            "created_at": int(self.commitment_count),
        }

        self._write_commitment(commitment_id, commitment)

        # Register in member index
        member_ids = self._get_member_commitments(owner_address)
        member_ids.append(commitment_id)
        self._set_member_commitments(owner_address, member_ids)

        # Register in global recent index for the public feed
        self.recent_ids[u256(int(self.commitment_count))] = commitment_id

        return commitment_id

    @gl.public.write
    def submit_proof(
        self,
        commitment_id: str,
        owner_address: str,
        proof_text: str,
        proof_link: str,
    ) -> None:
        """
        Submit proof before the proof deadline.
        Only the owner can submit. Must be in 'committed' status.
        Moves to 'evaluating' — the evaluate_commitment call fires next.
        """
        commitment = self._read_commitment(commitment_id)

        # Only the owner can submit proof
        if commitment["owner_address"] != owner_address:
            return

        # Must be in committed state — can't resubmit once evaluating or resolved
        if commitment["status"] != "committed":
            return

        # Require non-empty proof text — no blank submissions
        if not proof_text.strip():
            return

        commitment["proof_text"] = proof_text
        commitment["proof_link"] = proof_link if proof_link.strip() else None
        commitment["status"] = "evaluating"
        self._write_commitment(commitment_id, commitment)

    @gl.public.write
    def evaluate_commitment(self, commitment_id: str) -> None:
        """
        The one AI call. Fires after submit_proof moves status to 'evaluating'.
        Compares the immutably-locked criteria against the submitted proof.
        Returns KEPT / PARTIAL / BROKEN + reasoning + confidence.

        Takes 3–5 minutes on studionet. Frontend shows judging screen while polling.
        """
        commitment = self._read_commitment(commitment_id)

        # Gate: only run when in evaluating state
        if commitment["status"] != "evaluating":
            return

        goal_text = commitment["goal_text"]
        criteria_text = commitment["criteria_text"]
        proof_text = commitment["proof_text"] or ""
        proof_link = commitment["proof_link"] or "none provided"
        category = commitment["category"]

        prompt = (
            "You are an impartial accountability judge evaluating whether a personal commitment was kept.\n\n"
            "COMMITMENT DETAILS:\n"
            "Category: " + category + "\n"
            "Goal: " + goal_text + "\n"
            "Success criteria (written by the person BEFORE the deadline — immutable):\n"
            + criteria_text + "\n\n"
            "PROOF SUBMITTED BY THE PERSON:\n"
            "Description: " + proof_text + "\n"
            "Reference link: " + proof_link + "\n\n"
            "YOUR TASK:\n"
            "Compare the success criteria against the submitted proof.\n"
            "The criteria were written before the deadline and cannot be changed — they are the ground truth.\n"
            "Judge strictly based on whether the proof actually demonstrates the criteria were met.\n\n"
            "VERDICT RULES:\n"
            "- KEPT: proof clearly and specifically meets ALL stated criteria. No ambiguity.\n"
            "- PARTIAL: proof meets SOME but not all criteria, or the proof is present but too vague "
            "to confirm full completion.\n"
            "- BROKEN: proof clearly fails the criteria, is missing, or is too thin to count as evidence.\n\n"
            "CONFIDENCE RULES:\n"
            "- HIGH: the evidence is unambiguous in either direction\n"
            "- MEDIUM: reasonable interpretation required\n"
            "- LOW: very little evidence either way\n\n"
            "Be honest and strict. Do not give the benefit of the doubt beyond what the proof shows.\n"
            "Vague proof against specific criteria = PARTIAL or BROKEN.\n"
            "A heartfelt description without verifiable evidence = PARTIAL at best.\n\n"
            "Return ONLY a JSON object starting with { and ending with }. No markdown, no preamble.\n"
            'Format: {"verdict": "KEPT", "reasoning": "one concise sentence explaining the verdict", '
            '"confidence": "HIGH"}'
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate whether a personal commitment was kept based on self-written pre-deadline criteria and submitted proof",
            criteria="valid JSON with verdict (KEPT, PARTIAL, or BROKEN), a one-sentence reasoning, and confidence (HIGH, MEDIUM, or LOW)"
        )

        # Defensive JSON parsing — game never breaks even if AI returns garbage
        result_json = {}
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
        except Exception:
            result_json = {}

        verdict = result_json.get("verdict", "BROKEN")
        reasoning = result_json.get("reasoning", "Could not evaluate — defaulting to BROKEN.")
        confidence = result_json.get("confidence", "LOW")

        # Sanitise — only allow known values
        if verdict not in ("KEPT", "BROKEN", "PARTIAL"):
            verdict = "BROKEN"
        if confidence not in ("HIGH", "MEDIUM", "LOW"):
            confidence = "LOW"

        # Re-read after AI call in case state changed during consensus
        commitment = self._read_commitment(commitment_id)

        # Double-check status hasn't been altered by a race (belt-and-suspenders)
        if commitment["status"] != "evaluating":
            return

        commitment["verdict"] = verdict
        commitment["reasoning"] = reasoning
        commitment["confidence"] = confidence
        commitment["status"] = "resolved"
        self._write_commitment(commitment_id, commitment)

    @gl.public.write
    def check_expired(self, commitment_id: str) -> None:
        """
        Anyone can call this once the proof_deadline has passed and no proof was submitted.
        No AI call — deterministic. Mirrors the ADVANCE_FALLBACK pattern from the reference doc.
        Frontend polls for expired commitments and surfaces the "mark expired" button to any visitor.
        Status must still be 'committed' (not evaluating or resolved) for this to fire.
        """
        commitment = self._read_commitment(commitment_id)

        # Only applies to commitments where proof was never submitted
        if commitment["status"] != "committed":
            return

        commitment["status"] = "resolved"
        commitment["verdict"] = "BROKEN"
        commitment["reasoning"] = "No proof was submitted before the proof deadline."
        commitment["confidence"] = "HIGH"
        self._write_commitment(commitment_id, commitment)

    @gl.public.write
    def finalize_game(self, commitment_id: str) -> None:
        pass

    # ----------------------------------------------------------------
    # Public view methods
    # ----------------------------------------------------------------

    @gl.public.view
    def get_commitment(self, commitment_id: str) -> str:
        raw = self.commitments.get(commitment_id)
        if raw is None:
            return json.dumps({"error": "Commitment not found"})
        return raw

    @gl.public.view
    def get_my_commitments(self, address: str) -> str:
        """All commitments for an address, newest first."""
        ids = self._get_member_commitments(address)
        result = []
        for cid in ids:
            raw = self.commitments.get(cid)
            if raw is not None:
                result.append(json.loads(raw))
        result.sort(key=lambda x: x["created_at"], reverse=True)
        return json.dumps(result)

    @gl.public.view
    def get_profile(self, address: str) -> str:
        """
        Compute profile stats live from history — never stored as mutable state.
        Includes kept/broken/partial counts, current streak, longest streak.
        """
        profile = self._compute_profile(address)
        return json.dumps(profile)

    @gl.public.view
    def get_recent_commitments(self, limit: int) -> str:
        """
        Public feed — most recent commitments across all users.
        Used on the landing screen for social proof / browsability.
        """
        result = []
        total = int(self.commitment_count)
        for n in range(total, 0, -1):
            if len(result) >= limit:
                break
            cid_raw = self.recent_ids.get(u256(n))
            if cid_raw is not None:
                c_raw = self.commitments.get(cid_raw)
                if c_raw is not None:
                    result.append(json.loads(c_raw))
        return json.dumps(result)

    @gl.public.view
    def get_commitments_by_category(self, category: str, limit: int) -> str:
        """
        Filter public feed by category for the browse/explore screen.
        Walks recent_ids backwards, filters by category.
        """
        result = []
        total = int(self.commitment_count)
        for n in range(total, 0, -1):
            if len(result) >= limit:
                break
            cid_raw = self.recent_ids.get(u256(n))
            if cid_raw is not None:
                c_raw = self.commitments.get(cid_raw)
                if c_raw is not None:
                    c = json.loads(c_raw)
                    if c.get("category", "") == category:
                        result.append(c)
        return json.dumps(result)
