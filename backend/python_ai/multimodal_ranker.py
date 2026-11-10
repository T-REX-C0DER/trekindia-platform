"""
TrekIndia Multimodal Candidate Ranker & Confidence Calibration Engine
Combines deep visual similarity, contextual metadata, geographical priors,
and evidence weighting. Implements calibrated confidence scoring and honest rejection.
"""
from typing import List, Dict, Any, Optional
import numpy as np
import re

from .config import (
    CONFIDENCE_THRESHOLD_STRONG,
    CONFIDENCE_THRESHOLD_POSSIBLE,
    CONFIDENCE_THRESHOLD_REJECTION
)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def clean_text_tokens(text: str) -> set:
    """Extract clean lowercased alphanumeric tokens from text."""
    if not text:
        return set()
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))

def rank_candidates(
    query_vector: List[float],
    candidates: List[Dict[str, Any]],
    text_context: Optional[str] = None,
    geographic_context: Optional[Dict[str, Any]] = None,
    min_confidence_threshold: float = 0.40,
    top_k: int = 8
) -> Dict[str, Any]:
    """
    Ranks destination candidates using multi-signal scoring:
    - S_vis: deep visual cosine similarity [0.0 - 1.0]
    - S_geo: state / district matching prior [+0.05 to +0.10]
    - S_txt: caption / hashtag token overlap prior [+0.05 to +0.15]
    - S_ver: verification and evidence count prior [+0.02 to +0.06]
    """
    scored = []
    geo_state = (geographic_context or {}).get("state", "").lower().strip() if geographic_context else ""
    geo_district = (geographic_context or {}).get("district", "").lower().strip() if geographic_context else ""
    query_tokens = clean_text_tokens(text_context or "")

    for cand in candidates:
        cand_vec = cand.get("embedding", [])
        if not cand_vec:
            continue

        # If dimensions differ, adjust or pad
        if len(cand_vec) != len(query_vector):
            # Compute cosine similarity on minimum shared dimension
            min_dim = min(len(cand_vec), len(query_vector))
            vis_sim = cosine_similarity(query_vector[:min_dim], cand_vec[:min_dim])
        else:
            vis_sim = cosine_similarity(query_vector, cand_vec)

        # 1. Geographic Prior
        geo_bonus = 0.0
        cand_state = str(cand.get("state_name") or cand.get("state") or "").lower()
        cand_district = str(cand.get("district_name") or cand.get("district") or "").lower()

        if geo_state and (geo_state in cand_state or cand_state in geo_state):
            geo_bonus += 0.07
        if geo_district and (geo_district in cand_district or cand_district in geo_district):
            geo_bonus += 0.05

        # 2. Textual / Keyword Prior
        text_bonus = 0.0
        if query_tokens:
            cand_tokens = clean_text_tokens(
                f"{cand.get('trek_name', '')} {cand.get('slug', '')} {cand_state} {cand_district}"
            )
            overlap = query_tokens.intersection(cand_tokens)
            if overlap:
                text_bonus = min(0.12, len(overlap) * 0.05)

        # 3. Evidence & Verification Weighting
        evidence_count = int(cand.get("evidence_count") or 1)
        evidence_factor = min(0.05, np.log1p(evidence_count) * 0.015)
        verification_status = str(cand.get("verification_status") or "unverified")
        ver_bonus = 0.04 if verification_status in ["verified", "community_verified", "official_ground_truth"] else 0.0

        # Calibrated combined score
        raw_combined = vis_sim * 0.80 + geo_bonus + text_bonus + evidence_factor + ver_bonus
        calibrated_score = float(np.clip(raw_combined, 0.05, 0.98))

        # Categorical confidence band
        if calibrated_score >= CONFIDENCE_THRESHOLD_STRONG:
            band = "Strong Visual Match"
            band_color = "#285D2A"
            explanation = f"High visual correspondence to verified trail photographs of {cand.get('trek_name', 'this trek')}."
        elif calibrated_score >= CONFIDENCE_THRESHOLD_POSSIBLE:
            band = "Possible Match"
            band_color = "#708238"
            explanation = f"Moderate visual resemblance to {cand.get('trek_name', 'this trek')} landscape and terrain morphology."
        elif calibrated_score >= CONFIDENCE_THRESHOLD_REJECTION:
            band = "Similar Landscape"
            band_color = "#A5B5A8"
            explanation = f"Shares geological and elevation characteristics with {cand.get('trek_name', 'this trek')}."
        else:
            band = "Low Similarity"
            band_color = "#8C928D"
            explanation = "Terrain and visual profile diverge significantly."

        if geo_bonus > 0:
            explanation += f" Region aligns with {cand_state.title()}."
        if text_bonus > 0:
            explanation += " Mentioned in accompanying description."

        scored.append({
            "trek_id": cand.get("trek_id"),
            "name": cand.get("trek_name") or cand.get("name"),
            "slug": cand.get("slug"),
            "state": cand.get("state_name") or cand.get("state") or "India",
            "district": cand.get("district_name") or cand.get("district") or "",
            "difficulty": cand.get("difficulty", "Moderate"),
            "elevation_m": cand.get("elevation_m") or cand.get("highest_point_m", 0),
            "duration": cand.get("duration_label") or (f"{cand.get('duration_hours', 4)}h" if cand.get('duration_hours') else "1 Day"),
            "rating": cand.get("rating", "4.5"),
            "matched_image_url": cand.get("image_url") or "Nature.jpg",
            "calibrated_score": round(calibrated_score, 4),
            "similarity_percentage": f"{int(round(calibrated_score * 100))}%",
            "raw_similarity": round(vis_sim, 4),
            "confidence_band": band,
            "confidence_color": band_color,
            "evidence_count": evidence_count,
            "verification_status": verification_status,
            "explanation": explanation
        })

    # Sort descending by calibrated score
    scored.sort(key=lambda x: x["calibrated_score"], reverse=True)

    # Deduplicate by trek_id
    deduped = []
    seen = set()
    for item in scored:
        if item["trek_id"] not in seen:
            seen.add(item["trek_id"])
            deduped.append(item)

    top_matches = deduped[:top_k]

    # Confidence-based rejection decision
    top_cand = top_matches[0] if top_matches else None
    if top_cand and top_cand["calibrated_score"] >= CONFIDENCE_THRESHOLD_STRONG:
        is_confident = True
        status_message = f"Identified as {top_cand['name']} with high confidence."
        rejection_reason = None
    elif top_cand and top_cand["calibrated_score"] >= CONFIDENCE_THRESHOLD_POSSIBLE:
        is_confident = True
        status_message = f"Plausible candidate: {top_cand['name']}."
        rejection_reason = None
    elif top_cand:
        is_confident = False
        status_message = "Unable to identify this trek confidently. Here are some visually similar locations."
        rejection_reason = "Visual feature similarity did not meet the strict threshold for confident identification."
    else:
        is_confident = False
        status_message = "No trekking destination matched this photograph."
        rejection_reason = "No candidate treks available in the reference database."

    return {
        "is_confident_match": is_confident,
        "status_message": status_message,
        "rejection_reason": rejection_reason,
        "top_match": top_cand,
        "candidates": top_matches,
        "total_evaluated": len(candidates)
    }
