"""
TrekIndia Python Visual Intelligence Microservice (FastAPI)
Internal high-performance microservice executing local computer-vision inference,
deep PyTorch feature extraction, multimodal ranking, and continuous post ingestion.
Runs 100% locally with zero paid external APIs.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn

from .config import (
    MODEL_NAME, MODEL_VERSION, EMBEDDING_DIM, ARCHETYPE_LABELS,
    AI_SERVICE_HOST, AI_SERVICE_PORT
)
from .vision_engine import VisionEngine
from .multimodal_ranker import rank_candidates, cosine_similarity
from .evaluator import run_evaluation_benchmark

app = FastAPI(
    title="TrekIndia Visual Intelligence Engine",
    version=MODEL_VERSION,
    description="Local deep learning vision recognition and retrieval microservice for Indian mountain trails."
)

# ─── Pydantic Request & Response Schemas ─────────────────────────────────────────

class AnalyzeImageRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    geographic_context: Optional[Dict[str, Any]] = None

class CandidateItem(BaseModel):
    trek_id: int
    trek_name: Optional[str] = None
    name: Optional[str] = None
    slug: str
    state_name: Optional[str] = None
    state: Optional[str] = None
    district_name: Optional[str] = None
    district: Optional[str] = None
    difficulty: Optional[str] = "Moderate"
    elevation_m: Optional[int] = None
    highest_point_m: Optional[int] = None
    duration_label: Optional[str] = None
    duration_hours: Optional[float] = None
    rating: Optional[str] = "4.5"
    image_url: Optional[str] = None
    embedding: List[float]
    evidence_count: Optional[int] = 1
    verification_status: Optional[str] = "unverified"

class RankRequest(BaseModel):
    query_vector: List[float]
    candidates: List[CandidateItem]
    text_context: Optional[str] = None
    geographic_context: Optional[Dict[str, Any]] = None
    min_confidence_threshold: Optional[float] = 0.40
    top_k: Optional[int] = 8

class TrekVisionRequest(BaseModel):
    image_base64: str
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    candidates: Optional[List[CandidateItem]] = None
    geographic_context: Optional[Dict[str, Any]] = None

class PhotoDiscoveryRequest(BaseModel):
    image_base64: str
    candidates: List[CandidateItem]
    state_filter: Optional[str] = None
    difficulty_filter: Optional[str] = None
    min_similarity: Optional[float] = 0.40

# ─── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TrekIndia Deep Visual Intelligence Engine (Python / PyTorch)",
        "model": MODEL_NAME,
        "version": MODEL_VERSION,
        "embedding_dimensions": EMBEDDING_DIM,
        "archetype_count": len(ARCHETYPE_LABELS),
        "zero_paid_api_policy": "VERIFIED_ACTIVE"
    }

@app.post("/api/v1/extract-features")
def extract_features(req: AnalyzeImageRequest):
    """
    Extracts 576-dim deep feature vector and perceptual metrics directly from image pixels.
    """
    try:
        engine = VisionEngine.get_instance()
        raw_bytes, img_hash = engine.clean_base64(req.image_base64)
        analysis = engine.extract_features(raw_bytes)
        return {
            "success": True,
            "image_hash": img_hash,
            "dimensions": EMBEDDING_DIM,
            "vector": analysis["vector"],
            "dominant_features": analysis["dominant_features"],
            "terrain_archetype": analysis["terrain_archetype"],
            "metrics": analysis["metrics"],
            "model_name": MODEL_NAME,
            "model_version": MODEL_VERSION
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image feature extraction failed: {str(e)}")

@app.post("/api/v1/rank-candidates")
def rank_destinations(req: RankRequest):
    """
    Multimodal candidate ranking combining visual similarity, geographic alignment,
    textual overlap, and verification confidence.
    """
    try:
        candidate_dicts = [c.model_dump() for c in req.candidates]
        result = rank_candidates(
            query_vector=req.query_vector,
            candidates=candidate_dicts,
            text_context=req.text_context,
            geographic_context=req.geographic_context,
            min_confidence_threshold=req.min_confidence_threshold,
            top_k=req.top_k
        )
        return {
            "success": True,
            **result,
            "model_name": MODEL_NAME,
            "model_version": MODEL_VERSION
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking execution failed: {str(e)}")

@app.post("/api/v1/analyze-trekvision")
def analyze_trekvision(req: TrekVisionRequest):
    """
    End-to-end TrekVision processing:
    1. Extract deep features and terrain archetype.
    2. Analyze caption and hashtags.
    3. Match against reference candidate treks.
    4. Provide calibrated confidence and evidence explanation.
    """
    try:
        engine = VisionEngine.get_instance()
        raw_bytes, img_hash = engine.clean_base64(req.image_base64)
        visual_analysis = engine.extract_features(raw_bytes)

        full_text = " ".join(filter(None, [req.caption or "", " ".join(req.hashtags or [])]))

        candidates_dict = [c.model_dump() for c in (req.candidates or [])]

        ranking = rank_candidates(
            query_vector=visual_analysis["vector"],
            candidates=candidates_dict,
            text_context=full_text,
            geographic_context=req.geographic_context,
            min_confidence_threshold=0.40,
            top_k=5
        )

        # Generate contextual safety observations
        metrics = visual_analysis["metrics"]
        safety_tips = [
            "Check local weather forecast 48 hours prior to departure.",
            "Carry sufficient hydration and electrolytes for the trail."
        ]
        if metrics["snow_ratio"] > 0.15:
            safety_tips.append("Snow / ice detected: Crampons or microspikes strongly advised.")
            safety_tips.append("Watch for sudden temperature drops and avalanche hazard.")
        if metrics["rock_ratio"] > 0.25:
            safety_tips.append("Steep rock / scree: Trekking poles and ankle-support footwear recommended.")
        if metrics["green_ratio"] > 0.35:
            safety_tips.append("Dense forest / meadow: In monsoon season, carry salt or tobacco for leeches.")

        top_match = ranking["top_match"]

        return {
            "success": True,
            "image_hash": img_hash,
            "analysis": {
                "summary": f"{visual_analysis['terrain_archetype']} with prominent {', '.join(visual_analysis['dominant_features'][:3])}.",
                "mountain_range": req.geographic_context.get("state", "Indian Mountain Ranges") if req.geographic_context else "Himalayas / Western Ghats",
                "confidence_score": top_match["calibrated_score"] if top_match else 0.0,
                "identified_peaks": [top_match["name"]] if (top_match and ranking["is_confident_match"]) else [],
                "terrain": {
                    "type": visual_analysis["terrain_archetype"],
                    "trail_condition": "Snow/Ice cover" if metrics["snow_ratio"] > 0.20 else ("Rocky ridge" if metrics["rock_ratio"] > 0.25 else "Forest / Meadow path")
                },
                "snow_and_ice": {
                    "presence": metrics["snow_ratio"] > 0.05,
                    "coverage_percentage": int(round(metrics["snow_ratio"] * 100))
                },
                "safety_observations": safety_tips
            },
            "suggested_treks": [
                {
                    "trek_id": c["trek_id"],
                    "trek_name": c["name"],
                    "slug": c["slug"],
                    "state_name": c["state"],
                    "district_name": c["district"],
                    "confidence_score": c["calibrated_score"],
                    "similarity_percentage": c["similarity_percentage"],
                    "confidence_band": c["confidence_band"],
                    "confidence_color": c["confidence_color"],
                    "explanation": c["explanation"]
                }
                for c in ranking["candidates"]
            ],
            "is_confident_match": ranking["is_confident_match"],
            "status_message": ranking["status_message"],
            "rejection_reason": ranking["rejection_reason"],
            "model_version": MODEL_VERSION
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TrekVision analysis failed: {str(e)}")

@app.post("/api/v1/photo-discovery")
def photo_discovery(req: PhotoDiscoveryRequest):
    """
    End-to-end Photo-to-Trek Discovery:
    Extracts visual vector and retrieves closest verified treks with honest confidence.
    """
    try:
        engine = VisionEngine.get_instance()
        raw_bytes, img_hash = engine.clean_base64(req.image_base64)
        visual_analysis = engine.extract_features(raw_bytes)

        geo_ctx = {"state": req.state_filter} if req.state_filter else None
        candidates_dict = [c.model_dump() for c in req.candidates]

        ranking = rank_candidates(
            query_vector=visual_analysis["vector"],
            candidates=candidates_dict,
            geographic_context=geo_ctx,
            min_confidence_threshold=req.min_similarity or 0.40,
            top_k=8
        )

        return {
            "success": True,
            "query_image_hash": img_hash,
            "dominant_features": visual_analysis["dominant_features"],
            "terrain_archetype": visual_analysis["terrain_archetype"],
            "metrics": visual_analysis["metrics"],
            "is_confident_match": ranking["is_confident_match"],
            "status_message": ranking["status_message"],
            "rejection_reason": ranking["rejection_reason"],
            "top_match": ranking["top_match"],
            "results": ranking["candidates"],
            "total_matches": len(ranking["candidates"]),
            "model_version": MODEL_VERSION
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Photo discovery failed: {str(e)}")

@app.post("/api/v1/compute-similarity")
def compute_similarity(req: Dict[str, List[float]]):
    """Fast cosine similarity between two vectors."""
    v1 = req.get("v1", [])
    v2 = req.get("v2", [])
    if len(v1) == 0 or len(v2) == 0:
        raise HTTPException(status_code=400, detail="Vectors must be non-empty.")
    sim = cosine_similarity(v1, v2)
    return {"similarity": round(sim, 4)}

@app.get("/api/v1/evaluate")
def evaluate_benchmark():
    """Executes scientific evaluation benchmark."""
    report = run_evaluation_benchmark()
    return {"success": True, "evaluation": report}

if __name__ == "__main__":
    print(f"🚀 Starting TrekIndia Python Visual Intelligence Service on {AI_SERVICE_HOST}:{AI_SERVICE_PORT}")
    uvicorn.run(app, host=AI_SERVICE_HOST, port=AI_SERVICE_PORT, log_level="info")
