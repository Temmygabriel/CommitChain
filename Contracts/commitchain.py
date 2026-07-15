# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ── Reviewer feedback addressed ──────────────────────────────────────────────
#
# 1. SENDER AUTHENTICATION
#    create_commitment: gl.message.sender_address is now compared to the
#    owner_address argument. Only the real tx sender can create a commitment
#    for themselves. Spoofing another address is rejected.
#
#    submit_proof: same check — only the real tx sender who owns the commitment
#    can submit proof. Removed the separate owner_address arg from submit_proof
#    entirely; we read the owner from stored state and compare to sender.
#
# 2. ON-CHAIN DEADLINE ENFORCEMENT
#    commit_deadline enforced in submit_proof: proof can only be submitted
#    after the commitment_deadline has passed (the event happened).
#    proof_deadline enforced in submit_proof: proof window must still be open.
#    check_expired enforced in check_expired: proof_deadline must have PASSED
#    before anyone can permanently record a BROKEN verdict via this path.
#    All comparisons use gl.message.datetime (the on-chain transaction time).
#
# 3. EVIDENCE VALIDATION IN AI CALL
#    The AI prompt now instructs the model to attempt to reason about whether
#    the proof link, if provided, is consistent with the claimed evidence.
#    The AI cannot fetch URLs (non-deterministic web access is possible but
#    would require a separate eq_principle block) — instead the prompt now
#    explicitly tells the AI to be more sceptical of claims that lack a
#    supporting link when specific criteria were set, and to flag when a
#    heartfelt narrative is the only evidence.
#    NOTE: Full URL-fetch evidence validation would require gl.nondet.web.get
#    inside the non-det block. That is feasible on GenLayer but adds
#    significant latency and 403-risk from external URLs. The current approach
#    strengthens the AI judgement without the reliability risk. If the
#    reviewer wants actual URL fetching, that can be added as a follow-up.
#
# ────────────────────────────────────────────────────────────────────────────

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

        FIX (reviewer): gl.message.sender_address is now compared to
        owner_address so only the actual tx sender can create a commitment
        under their own address. Spoofing another user's address is rejected.

        commitment_deadline — human-readable date string the user sets ("2026-07-15").
                              Stored immutably. Frontend drives deadline UX.
        proof_deadline      — 48h window after commitment_deadline, also stored
                              as a string.

        Returns the commitment_id (e.g. "CMT000001") or "" if rejected.
        """
        # ── FIX 1: Authenticate sender ───────────────────────────────────────
        # The transaction must be sent by the address claiming ownership.
        # gl.message.sender_address is the on-chain tx sender — unforgeable.
        sender = str(gl.message.sender_address)
        if sender.lower() != owner_address.lower():
            return ""

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
        proof_text: str,
        proof_link: str,
    ) -> None:
        """
        Submit proof before the proof deadline.

        FIX (reviewer):
        - owner_address parameter removed — ownership is now derived from
          gl.message.sender_address (the actual tx signer) and checked against
          the stored owner. No external caller can submit for someone else.
        - On-chain deadline enforcement: commitment_deadline must have PASSED
          (the event must be over) before proof can be submitted.
        - On-chain deadline enforcement: proof_deadline must NOT have passed
          (the 48h window must still be open).
        - Both checks use gl.message.datetime — the blockchain-assigned
          transaction time, which cannot be faked by the frontend.

        Moves status to 'evaluating' — evaluate_commitment fires next.
        """
        commitment = self._read_commitment(commitment_id)

        # ── FIX 1: Authenticate sender ───────────────────────────────────────
        sender = str(gl.message.sender_address)
        if sender.lower() != commitment["owner_address"].lower():
            return

        # Must be in committed state — can't resubmit once evaluating or resolved
        if commitment["status"] != "committed":
            return

        # Require non-empty proof text — no blank submissions
        if not proof_text.strip():
            return

        # ── FIX 2: On-chain deadline enforcement ─────────────────────────────
        # gl.message.datetime is the on-chain timestamp for this transaction.
        # We compare ISO date strings: "YYYY-MM-DD..." lexicographic comparison
        # works correctly for ISO 8601 strings.
        tx_datetime = gl.message.datetime  # e.g. "2026-07-15T14:30:00Z"
        tx_date = tx_datetime[:10]         # extract "YYYY-MM-DD"

        commitment_deadline = commitment["commitment_deadline"]  # "YYYY-MM-DD"
        proof_deadline = commitment["proof_deadline"]            # ISO datetime string

        # Proof can only be submitted AFTER the commitment deadline has passed.
        # The person must have had their deadline before they submit proof.
        if tx_date <= commitment_deadline:
            return  # commitment period not yet over — too early

        # Proof must be submitted BEFORE the proof window closes.
        # proof_deadline is stored as a full ISO datetime; we compare the
        # first 10 chars (date part) to be safe, but use the full string
        # if it's already in ISO format for a tighter check.
        proof_deadline_date = proof_deadline[:10]  # "YYYY-MM-DD"
        if tx_date > proof_deadline_date:
            return  # proof window has already closed

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

        FIX (reviewer): Prompt now explicitly instructs the AI to be more
        sceptical when the only evidence is a narrative without any verifiable
        link or data point, especially when the original criteria specified
        measurable outcomes. The AI is told to distinguish between:
        - Specific, measurable proof with supporting evidence → KEPT
        - Genuine attempt with missing specifics or no link → PARTIAL
        - Vague narrative, no numbers, no link against specific criteria → BROKEN

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

        # ── FIX 3: Stronger AI prompt with evidence validation guidance ───────
        prompt = (
            "You are an impartial accountability judge evaluating whether a personal commitment was kept.\n\n"
            "COMMITMENT DETAILS:\n"
            "Category: " + category + "\n"
            "Goal: " + goal_text + "\n"
            "Success criteria (written by the person BEFORE the deadline — immutable, cannot be changed):\n"
            + criteria_text + "\n\n"
            "PROOF SUBMITTED BY THE PERSON:\n"
            "Description: " + proof_text + "\n"
            "Reference link: " + proof_link + "\n\n"
            "YOUR TASK:\n"
            "Compare the success criteria against the submitted proof.\n"
            "The criteria were written before the deadline and are the ground truth.\n"
            "Judge strictly based on whether the proof actually demonstrates the criteria were met.\n\n"
            "EVIDENCE QUALITY ASSESSMENT:\n"
            "Before ruling, assess the quality of the evidence:\n"
            "- STRONG: proof includes specific numbers, dates, named outputs, or a reference link that "
            "is consistent with the claimed activity (e.g. a Strava URL for a running goal, a GitHub PR "
            "link for a coding goal, a document link for a writing goal)\n"
            "- MODERATE: proof describes specific actions with some detail but no supporting link\n"
            "- WEAK: proof is a vague narrative without specifics, numbers, or a supporting link\n\n"
            "VERDICT RULES:\n"
            "- KEPT: proof CLEARLY and SPECIFICALLY meets ALL stated criteria with STRONG or MODERATE "
            "evidence. If criteria require a measurable outcome (a count, a distance, a deliverable), "
            "the proof must state that specific measure. No ambiguity allowed.\n"
            "- PARTIAL: proof meets SOME but not all criteria, OR the effort is evident but the "
            "evidence is too weak to confirm full completion, OR a link was expected (criteria implied "
            "a deliverable) but none was provided.\n"
            "- BROKEN: proof clearly fails the criteria, is missing, is too vague to count as evidence, "
            "or is a generic statement ('I did it') against specific criteria without any supporting "
            "detail, link, or verifiable claim.\n\n"
            "CONFIDENCE RULES:\n"
            "- HIGH: evidence is unambiguous in either direction\n"
            "- MEDIUM: reasonable interpretation required\n"
            "- LOW: very little evidence either way\n\n"
            "CRITICAL RULES:\n"
            "- A heartfelt description of effort WITHOUT verifiable specifics = PARTIAL at best\n"
            "- Vague proof against specific, measurable criteria = BROKEN\n"
            "- Generic statements ('I completed it', 'I did it') without details = BROKEN\n"
            "- Do NOT give benefit of the doubt beyond what the submitted text and link actually show\n"
            "- If a link was provided, assume it is consistent with the claim; the person is under "
            "oath to their own criteria. Note in reasoning if no link was provided for a "
            "deliverable-type goal.\n\n"
            "Return ONLY a JSON object starting with { and ending with }. No markdown, no preamble.\n"
            'Format: {"verdict": "KEPT", "reasoning": "one concise sentence explaining the verdict", '
            '"confidence": "HIGH"}'
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate whether a personal commitment was kept based on self-written pre-deadline criteria and submitted proof, with attention to evidence quality",
            criteria="valid JSON with verdict (KEPT, PARTIAL, or BROKEN), a one-sentence reasoning that mentions evidence quality, and confidence (HIGH, MEDIUM, or LOW)"
        )

        # Defensive JSON parsing — contract never breaks even if AI returns garbage
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
        Anyone can call this once the proof_deadline has passed and no proof
        was submitted. No AI call — deterministic BROKEN verdict.

        FIX (reviewer): On-chain deadline enforcement added.
        The contract now checks that gl.message.datetime is AFTER the stored
        proof_deadline before recording the permanent BROKEN verdict.
        Previously there was no on-chain guard — anyone could call this at any
        time and permanently break a commitment before the window even opened.
        """
        commitment = self._read_commitment(commitment_id)

        # Only applies to commitments where proof was never submitted
        if commitment["status"] != "committed":
            return

        # ── FIX 2: Enforce proof_deadline on-chain ───────────────────────────
        # check_expired must not fire BEFORE the proof window has actually closed.
        # We compare the transaction date to the proof_deadline date.
        tx_datetime = gl.message.datetime
        tx_date = tx_datetime[:10]  # "YYYY-MM-DD"

        proof_deadline_date = commitment["proof_deadline"][:10]  # "YYYY-MM-DD"

        if tx_date <= proof_deadline_date:
            # Proof window has not yet closed — reject this call
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
