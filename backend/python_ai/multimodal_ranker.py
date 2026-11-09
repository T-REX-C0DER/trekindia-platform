"""
TrekIndia Python Multimodal Ranker & Confidence Estimator
Computes cosine similarity, applies multi-signal ranking (visual + text + geographic + verification),
and calibrates honest confidence with explicit unknown-destination rejection.
"""
import numpy as np

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity between two unit or raw vectors."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def rank_candidates(
    query_vector: list[float],
    candidates: list[dict],
    geographic_context: dict = None,
    min_confidence_threshold: float = 0.55,
    top_k: int = 8
) -> dict:
    """
    Ranks destination candidates using multi-signal scoring:
    - S_vis: visual cosine similarity
    - S_geo: state/region proximity bonus
    - S_ver: verification & evidence count weighting
    - Calibration: mapped to honest confidence categories
    """
    scored = []
    geo_state = (geographic_context or {}).get("state", "").lower() if geographic_context else ""

    for cand in candidates:
        cand_vec = cand.get("embedding", [])
        if not cand_vec:
            continue
            
        vis_sim = cosine_similarity(query_vector, cand_vec)
        
        # Geographic bonus (+0.08 if matches user provided region)
        geo_bonus = 0.0
        cand_state = str(cand.get("state_name", "")).lower()
        if geo_state and cand_state and (geo_state in cand_state or cand_state in geo_state):
            geo_bonus = 0.08
            
        # Evidence & verification weighting
        evidence_count = cand.get("evidence_count", 1)
        evidence_factor = min(0.06, np.log1p(evidence_count) * 0.02)
        verification_status = cand.get("verification_status", "unverified")
        ver_bonus = 0.05 if verification_status in ["verified", "community_verified", "official_ground_truth"] else 0.0
        
        # Combined calibrated score
        calibrated_score = float(np.clip(vis_sim * 0.85 + geo_bonus + evidence_factor + ver_bonus, 0.01, 0.98))
        
        # Categorical confidence band
        if calibrated_score >= 0.82:
            band = "Strong Visual Match"
            band_color = "#285D2A"
        elif calibrated_score >= 0.68:
            band = "Possible Match"
            band_color = "#708238"
        elif calibrated_score >= 0.50:
            band = "Similar Landscape"
            band_color = "#A5B5A8"
        else:
            band = "Low Similarity"
            band_color = "#8C928D"
            
        scored.append({
            "trek_id": cand.get("trek_id"),
            "name": cand.get("trek_name"),
            "slug": cand.get("slug"),
            "state": cand.get("state_name", "India"),
            "district": cand.get("district_name", ""),
            "difficulty": cand.get("difficulty", "Moderate"),
            "elevation_m": cand.get("elevation_m") or cand.get("highest_point_m", 0),
            "duration": cand.get("duration_label") or f"{cand.get('duration_hours', 4)}h",
            "rating": cand.get("rating", "4.5"),
            "matched_image_url": cand.get("image_url", "Nature.jpg"),
            "calibrated_score": round(calibrated_score, 4),
            "similarity_percentage": f"{int(round(calibrated_score * 100))}%",
            "raw_similarity": round(vis_sim, 4),
            "confidence_band": band,
            "confidence_color": band_color,
            "evidence_count": evidence_count,
            "verification_status": verification_status
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
            
    final_candidates = deduped[:top_k]
    
    # Honest Unknown Destination detection
    is_confident = len(final_candidates) > 0 and final_candidates[0]["calibrated_score"] >= min_confidence_threshold
    primary = final_candidates[0] if is_confident else None
    alternatives = final_candidates[1:] if is_confident else final_candidates
    
    if is_confident:
        message = f"Visual evidence strongly suggests {primary['name']} ({primary['similarity_percentage']} confidence)."
    elif len(final_candidates) > 0:
        message = "We could not confidently identify this exact destination. Showing the most visually comparable Indian mountain landscapes."
    else:
        message = "No matching mountain destinations found with sufficient visual similarity."
        
    return {
        "is_confident_match": is_confident,
        "primary_destination": primary,
        "alternative_candidates": alternatives,
        "total_evaluated": len(candidates),
        "message": message,
        "disclaimer": "Visual similarity indicates comparable terrain, flora, and morphology, and does not certify satellite GPS provenance."
    }

