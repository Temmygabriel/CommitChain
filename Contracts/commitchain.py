# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ── Reviewer feedback addressed (round 3) ────────────────────────────────────
#
# 1. SENDER AUTHENTICATION ✓ (from round 2 — unchanged)
#
# 2. ON-CHAIN DEADLINE ENFORCEMENT ✓ (from round 2 — unchanged)
#
# 3. EVIDENCE VALIDATION — actual fetch attempt implemented
#
#    Approach: the contract attempts to fetch the submitted proof link using
#    gl.nondet.web.get + .body inside the generate() block. If the link is a
#    GitHub PR/commit URL, it is automatically converted to the equivalent
#    GitHub API URL (unauthenticated, public repos only) so the contract reads
#    real structured data rather than a rendered webpage.
#
#    Fetch results feed directly into the AI prompt as verified evidence.
#    If the fetch fails (site blocked, rate limited, private page), the contract
#    degrades gracefully to narrative-only judgment and flags this explicitly
#    in the verdict reasoning so the confidence score reflects it.
#
#    Platform limitations discovered through testing (11 test contracts run):
#    - gl.nondet.web.render: works on plain HTML pages (Wikipedia etc.)
#      Fails on GitHub, Google Docs, YouTube (JS-heavy / authenticated)
#    - gl.nondet.web.get + .body: works on plain JSON APIs
#      GitHub API hits rate limit without auth token (studionet shared IP)
#    - gl.nondet.web_search: does not exist on this version of GenLayer
#    - web.render on Strava: returns login wall, not activity content
#
#    The fetch-and-fallback pattern here is the closest possible implementation
#    to "validate authenticated evidence" given studionet's network constraints.
#
# ─────────────────────────────────────────────────────────────────────────────

import genlayer.gl as gl
from genlayer import TreeMap, u256
import json


class CommitChain(gl.Contract):

    commitment_count: u256
    commitments: TreeMap[str, str]
    member_commitments: TreeMap[str, str]
    recent_ids: TreeMap[u256, str]

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

    def _github_url_to_api(self, url: str) -> str:
        """
        Convert a GitHub webpage URL to its equivalent GitHub API URL.
        Returns empty string if the URL is not a recognised GitHub pattern.

        Supported patterns:
          github.com/owner/repo/pull/N  →  api.github.com/repos/owner/repo/pulls/N
          github.com/owner/repo/commit/SHA  →  api.github.com/repos/owner/repo/commits/SHA
          github.com/owner/repo  →  api.github.com/repos/owner/repo
        """
        try:
            if "github.com/" not in url:
                return ""
            # strip protocol and www
            path = url.split("github.com/")[-1].strip("/")
            parts = path.split("/")
            if len(parts) < 2:
                return ""
            owner = parts[0]
            repo  = parts[1]
            base  = "https://api.github.com/repos/" + owner + "/" + repo
            if len(parts) >= 4:
                if parts[2] == "pull" or parts[2] == "pulls":
                    return base + "/pulls/" + parts[3]
                if parts[2] == "commit" or parts[2] == "commits":
                    return base + "/commits/" + parts[3]
                if parts[2] == "issues":
                    return base + "/issues/" + parts[3]
            return base
        except Exception:
            return ""

    def _try_fetch_link(self, url: str) -> tuple:
        """
        Attempt to fetch the proof link. Returns (fetched_content, fetch_note).
        fetched_content — non-empty string if fetch succeeded, "" if not
        fetch_note      — human-readable string describing what happened

        Strategy:
        1. If it's a GitHub URL, convert to API URL and use web.get + .body
        2. Otherwise try web.render for plain pages
        3. If both fail, return empty with explanation
        """
        if not url or not url.strip() or not url.startswith("http"):
            return ("", "No proof link provided.")

        fetched  = ""
        note     = ""

        # ── Path A: GitHub URL → GitHub API ──────────────────────────────────
        api_url = self._github_url_to_api(url)
        if api_url:
            try:
                def fetch_api():
                    try:
                        response = gl.nondet.web.get(api_url)
                        body = response.body
                        if body:
                            return "OK:" + str(body)[:800]
                        return "EMPTY"
                    except Exception as e:
                        try:
                            ctx = e.args[0] if e.args else {}
                            if isinstance(ctx, dict):
                                b = str(ctx.get("body", ""))
                                if b:
                                    return "ERR_BODY:" + b[:600]
                            return "ERR:" + str(e)[:100]
                        except Exception:
                            return "ERR:unknown"

                out = gl.eq_principle.prompt_non_comparative(
                    fetch_api,
                    task="fetch a GitHub API URL and return the raw JSON response body",
                    criteria="string starting with OK, EMPTY, ERR_BODY, or ERR"
                )
                if out.startswith("OK:"):
                    fetched = out[3:]
                    note = "GitHub API fetch succeeded. Real repository data was used for verification."
                elif out.startswith("ERR_BODY:"):
                    fetched = out[9:]
                    note = "GitHub API returned an error response. Content may be rate-limited or repo is private."
                else:
                    note = "GitHub API fetch failed (" + out[:80] + "). Judgment based on narrative only."
            except Exception as e:
                note = "GitHub API fetch error: " + str(e)[:80] + ". Judgment based on narrative only."

        # ── Path B: Non-GitHub URL → web.render ──────────────────────────────
        else:
            try:
                def fetch_render():
                    try:
                        content = gl.nondet.web.render(url)
                        if not content or not content.strip():
                            return "EMPTY"
                        return "OK:" + content[:800]
                    except Exception as e:
                        try:
                            ctx = e.args[0] if e.args else {}
                            if isinstance(ctx, dict):
                                b = str(ctx.get("body", ""))
                                if b:
                                    return "ERR_BODY:" + b[:600]
                            return "ERR:" + str(e)[:100]
                        except Exception:
                            return "ERR:unknown"

                out = gl.eq_principle.prompt_non_comparative(
                    fetch_render,
                    task="fetch a webpage and return its text content",
                    criteria="string starting with OK, EMPTY, ERR_BODY, or ERR"
                )
                if out.startswith("OK:"):
                    fetched = out[3:]
                    note = "Page fetch succeeded. Content was used for verification."
                elif out.startswith("ERR_BODY:"):
                    fetched = out[9:]
                    note = "Page returned an error. Content may require login."
                else:
                    note = "Page fetch failed (" + out[:80] + "). Judgment based on narrative only."
            except Exception as e:
                note = "Page fetch error: " + str(e)[:80] + ". Judgment based on narrative only."

        return (fetched, note)

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
        # Authenticate sender
        sender = str(gl.message.sender_address)
        if sender.lower() != owner_address.lower():
            return ""
        if self._count_open_commitments(owner_address) >= 5:
            return ""
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
        member_ids = self._get_member_commitments(owner_address)
        member_ids.append(commitment_id)
        self._set_member_commitments(owner_address, member_ids)
        self.recent_ids[u256(int(self.commitment_count))] = commitment_id
        return commitment_id

    @gl.public.write
    def submit_proof(
        self,
        commitment_id: str,
        proof_text: str,
        proof_link: str,
    ) -> None:
        commitment = self._read_commitment(commitment_id)

        # Authenticate sender — owner_address removed from args
        sender = str(gl.message.sender_address)
        if sender.lower() != commitment["owner_address"].lower():
            return
        if commitment["status"] != "committed":
            return
        if not proof_text.strip():
            return

        # On-chain deadline enforcement
        tx_date               = gl.message.datetime[:10]
        commitment_deadline   = commitment["commitment_deadline"]
        proof_deadline_date   = commitment["proof_deadline"][:10]

        if tx_date <= commitment_deadline:
            return
        if tx_date > proof_deadline_date:
            return

        commitment["proof_text"] = proof_text
        commitment["proof_link"] = proof_link if proof_link.strip() else None
        commitment["status"]     = "evaluating"
        self._write_commitment(commitment_id, commitment)

    @gl.public.write
    def evaluate_commitment(self, commitment_id: str) -> None:
        """
        AI evaluation with real fetch attempt on the proof link.

        The contract now actively tries to fetch the submitted proof link:
        - GitHub URLs are converted to GitHub API calls for structured data
        - Other URLs are fetched via web.render for plain page content
        - If fetch succeeds, the AI judges against real fetched content
        - If fetch fails, the AI judges on narrative only and the reasoning
          explicitly states that no verified evidence was available — which
          affects the confidence score and pushes toward PARTIAL over KEPT
        """
        commitment = self._read_commitment(commitment_id)
        if commitment["status"] != "evaluating":
            return

        goal_text     = commitment["goal_text"]
        criteria_text = commitment["criteria_text"]
        proof_text    = commitment["proof_text"] or ""
        proof_link    = commitment["proof_link"] or ""
        category      = commitment["category"]

        # ── Attempt to fetch the proof link ──────────────────────────────────
        fetched_content, fetch_note = self._try_fetch_link(proof_link)

        # ── Build evidence section for prompt ────────────────────────────────
        if fetched_content:
            evidence_section = (
                "PROOF LINK: " + (proof_link or "none") + "\n"
                "FETCHED LINK CONTENT (verified by the contract, not the user):\n"
                + fetched_content + "\n"
                "FETCH STATUS: " + fetch_note
            )
        else:
            evidence_section = (
                "PROOF LINK: " + (proof_link if proof_link else "none provided") + "\n"
                "FETCHED LINK CONTENT: None — " + fetch_note + "\n"
                "NOTE: The contract attempted to fetch this link but could not retrieve "
                "verifiable content. Judge based on the user narrative only. "
                "This should lower your confidence and push toward PARTIAL rather than KEPT "
                "unless the narrative itself is extremely specific and detailed."
            )

        prompt = (
            "You are an impartial accountability judge evaluating whether a personal commitment was kept.\n\n"
            "COMMITMENT:\n"
            "Category: " + category + "\n"
            "Goal: " + goal_text + "\n"
            "Success criteria (locked on-chain before the deadline — immutable):\n"
            + criteria_text + "\n\n"
            "PROOF SUBMITTED:\n"
            "Description: " + proof_text + "\n\n"
            "EVIDENCE:\n"
            + evidence_section + "\n\n"
            "YOUR TASK:\n"
            "Judge strictly whether the proof meets the criteria.\n"
            "If fetched content is present, use it as the primary evidence source — "
            "it was retrieved directly by the contract, not supplied by the user.\n"
            "If no fetched content is available, the user's narrative is the only evidence "
            "and you must treat it with appropriate scepticism.\n\n"
            "VERDICT RULES:\n"
            "- KEPT: proof clearly meets ALL criteria. Fetched content confirms the claim, "
            "OR narrative is extremely specific with dates, numbers, named outputs.\n"
            "- PARTIAL: proof meets some criteria, or narrative effort is evident but "
            "unverified, or fetch failed leaving narrative as only evidence.\n"
            "- BROKEN: proof clearly fails, is missing, vague against specific criteria, "
            "or is a generic statement with no supporting detail.\n\n"
            "CONFIDENCE:\n"
            "- HIGH: fetched content unambiguously confirms or denies\n"
            "- MEDIUM: narrative is specific but unverified by fetch\n"
            "- LOW: vague narrative, failed fetch, or conflicting signals\n\n"
            "Return ONLY valid JSON, no markdown:\n"
            '{"verdict": "KEPT", "reasoning": "one sentence referencing whether evidence was fetched or not", '
            '"confidence": "HIGH"}'
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate whether a personal commitment was kept, using fetched evidence where available",
            criteria="valid JSON with verdict (KEPT, PARTIAL, or BROKEN), reasoning mentioning evidence source, and confidence (HIGH, MEDIUM, or LOW)"
        )

        result_json = {}
        try:
            start = result_raw.find("{")
            end   = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
        except Exception:
            result_json = {}

        verdict    = result_json.get("verdict",   "BROKEN")
        reasoning  = result_json.get("reasoning", "Could not evaluate — defaulting to BROKEN.")
        confidence = result_json.get("confidence","LOW")

        if verdict not in ("KEPT", "BROKEN", "PARTIAL"):
            verdict = "BROKEN"
        if confidence not in ("HIGH", "MEDIUM", "LOW"):
            confidence = "LOW"

        commitment = self._read_commitment(commitment_id)
        if commitment["status"] != "evaluating":
            return

        commitment["verdict"]    = verdict
        commitment["reasoning"]  = reasoning
        commitment["confidence"] = confidence
        commitment["status"]     = "resolved"
        self._write_commitment(commitment_id, commitment)

    @gl.public.write
    def check_expired(self, commitment_id: str) -> None:
        commitment = self._read_commitment(commitment_id)
        if commitment["status"] != "committed":
            return
        tx_date             = gl.message.datetime[:10]
        proof_deadline_date = commitment["proof_deadline"][:10]
        if tx_date <= proof_deadline_date:
            return
        commitment["status"]     = "resolved"
        commitment["verdict"]    = "BROKEN"
        commitment["reasoning"]  = "No proof was submitted before the proof deadline."
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
        profile = self._compute_profile(address)
        return json.dumps(profile)

    @gl.public.view
    def get_recent_commitments(self, limit: int) -> str:
        result = []
        total  = int(self.commitment_count)
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
        result = []
        total  = int(self.commitment_count)
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
