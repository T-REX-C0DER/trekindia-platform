"""
TrekIndia Python AI Service (FastAPI)
Internal high-performance microservice executing local computer-vision inference,
embedding generation, multimodal ranking, and continuous post ingestion.
Runs 100% locally with zero paid external APIs.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn

from .config import MODEL_NAME, MODEL_VERSION, EMBEDDING_DIM, ARCHETYPE_LABELS
from .image_processor import clean_base64, extract_visual_features
from .multimodal_ranker import rank_candidates, cosine_similarity

app = FastAPI(
    title="TrekIndia Visual Intelligence Engine",
    version=MODEL_VERSION,
    description="Python-powered multimodal vision recognition and retrieval system for Indian mountain trails."
)

# ─── Pydantic Request & Response Schemas ─────────────────────────────────────────

class AnalyzeImageRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    geographic_context: Optional[Dict[str, Any]] = None

class CandidateItem(BaseModel):
    trek_id: int
    trek_name: str
    slug: str
    state_name: Optional[str] = None
    district_name: Optional[str] = None
    difficulty: Optional[str] = None
    elevation_m: Optional[int] = None
    duration_label: Optional[str] = None
    rating: Optional[str] = None
    image_url: Optional[str] = None
    embedding: List[float]
    evidence_count: Optional[int] = 1
    verification_status: Optional[str] = "unverified"

class RankRequest(BaseModel):
    query_vector: List[float]
    candidates: List[CandidateItem]
    geographic_context: Optional[Dict[str, Any]] = None
    min_confidence_threshold: Optional[float] = 0.55
    top_k: Optional[int] = 8

class FeedbackRequest(BaseModel):
    image_url: str
    image_hash: Optional[str] = None
    predicted_trek_id: Optional[int] = None
    suggested_trek_id: Optional[int] = None
    feedback_type: str
    user_notes: Optional[str] = None
    user_id: Optional[int] = None

# ─── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TrekIndia Visual Intelligence Engine (Python)",
        "model": MODEL_NAME,
        "version": MODEL_VERSION,
        "embedding_dimensions": EMBEDDING_DIM,
        "archetype_count": len(ARCHETYPE_LABELS),
        "zero_paid_api_policy": "VERIFIED_ACTIVE"
    }

@app.post("/api/v1/extract-features")
def extract_features(req: AnalyzeImageRequest):
    """
    Extracts 64-dim visual feature vector, perceptual metrics and terrain archetype
    directly from an image using pure local Python computer-vision.
    """
    try:
        raw_bytes, img_hash = clean_base64(req.image_base64)
        analysis = extract_visual_features(raw_bytes)
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
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

@app.post("/api/v1/rank-candidates")
def rank_destinations(req: RankRequest):
    """
    Multimodal candidate ranking combining visual similarity, geographic alignment,
    and verification confidence.
    """
    try:
        candidate_dicts = [c.model_dump() for c in req.candidates]
        result = rank_candidates(
            query_vector=req.query_vector,
            candidates=candidate_dicts,
            geographic_context=req.geographic_context,
            min_confidence_threshold=req.min_confidence_threshold,
            top_k=req.top_k
        )
        return {
            "success": True,
            **result,
            "model_version": MODEL_VERSION
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking execution failed: {str(e)}")

@app.post("/api/v1/compute-similarity")
def compute_similarity(req: Dict[str, List[float]]):
    """Fast cosine similarity computation between two vectors."""
    v1 = req.get("v1", [])
    v2 = req.get("v2", [])
    if len(v1) != len(v2) or len(v1) == 0:
        raise HTTPException(status_code=400, detail="Vectors must be non-empty and of equal dimension.")
    sim = cosine_similarity(v1, v2)
    return {"similarity": round(sim, 4)}

if __name__ == "__main__":
    from .config import AI_SERVICE_HOST, AI_SERVICE_PORT
    print(f"🚀 Starting TrekIndia Python Visual Intelligence Service on {AI_SERVICE_HOST}:{AI_SERVICE_PORT}")
    uvicorn.run(app, host=AI_SERVICE_HOST, port=AI_SERVICE_PORT, log_level="info")

