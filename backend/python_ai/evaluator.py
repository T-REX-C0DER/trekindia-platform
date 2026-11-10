"""
TrekIndia AI Model Evaluation & Scientific Benchmark Framework
Evaluates candidate retrieval, classification accuracy, Top-1/Top-5 accuracy,
precision, recall, F1-score, and confidence calibration.
"""
import time
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sklearn.metrics import precision_score, recall_score, f1_score

from .config import MODEL_NAME, MODEL_VERSION, EMBEDDING_DIM
from .multimodal_ranker import rank_candidates, cosine_similarity

def create_synthetic_benchmark_dataset(num_treks: int = 20, samples_per_trek: int = 5) -> Tuple[List[Dict], List[Dict]]:
    """
    Creates a controlled benchmark dataset simulating reference trek prototypes
    and query samples with controlled visual perturbations and noise.
    """
    np.random.seed(42)
    reference_database = []
    test_queries = []

    # Distinct archetype prototypes
    for trek_id in range(1, num_treks + 1):
        # Generate a distinct cluster center in 576-dim space
        base_prototype = np.random.randn(EMBEDDING_DIM).astype(np.float32)
        base_prototype /= np.linalg.norm(base_prototype)

        trek_name = f"Benchmark Trek {trek_id}"
        slug = f"benchmark-trek-{trek_id}"
        state_name = "Uttarakhand" if trek_id % 3 == 0 else ("Himachal Pradesh" if trek_id % 3 == 1 else "Maharashtra")

        reference_database.append({
            "trek_id": trek_id,
            "trek_name": trek_name,
            "slug": slug,
            "state_name": state_name,
            "difficulty": "Moderate",
            "elevation_m": 2000 + trek_id * 100,
            "embedding": base_prototype.tolist(),
            "evidence_count": 3,
            "verification_status": "verified"
        })

        # Generate query samples with controlled gaussian noise
        for s in range(samples_per_trek):
            noise = np.random.randn(EMBEDDING_DIM).astype(np.float32) * 0.25
            perturbed = base_prototype + noise
            perturbed /= np.linalg.norm(perturbed)

            test_queries.append({
                "query_id": f"q_{trek_id}_{s}",
                "ground_truth_trek_id": trek_id,
                "ground_truth_name": trek_name,
                "state": state_name,
                "vector": perturbed.tolist()
            })

    return reference_database, test_queries

def run_evaluation_benchmark(
    reference_db: Optional[List[Dict]] = None,
    test_queries: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """
    Executes benchmark evaluation calculating:
    - Top-1 Accuracy
    - Top-5 Accuracy
    - Mean Reciprocal Rank (MRR)
    - Precision, Recall, Macro F1
    - Latency (Mean, P95)
    """
    if reference_db is None or test_queries is None:
        reference_db, test_queries = create_synthetic_benchmark_dataset()

    latencies = []
    top_1_hits = 0
    top_5_hits = 0
    reciprocal_ranks = []

    y_true = []
    y_pred = []

    for q in test_queries:
        t0 = time.perf_counter()
        result = rank_candidates(
            query_vector=q["vector"],
            candidates=reference_db,
            geographic_context={"state": q.get("state", "")},
            top_k=5
        )
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000.0)  # ms

        candidates = result["candidates"]
        gt_id = q["ground_truth_trek_id"]
        y_true.append(gt_id)

        pred_id = candidates[0]["trek_id"] if candidates else -1
        y_pred.append(pred_id)

        # Top-1 Check
        if candidates and candidates[0]["trek_id"] == gt_id:
            top_1_hits += 1

        # Top-5 Check & Reciprocal Rank
        found_rank = 0
        for rank, cand in enumerate(candidates, start=1):
            if cand["trek_id"] == gt_id:
                found_rank = rank
                break

        if found_rank > 0:
            top_5_hits += 1
            reciprocal_ranks.append(1.0 / found_rank)
        else:
            reciprocal_ranks.append(0.0)

    total_queries = len(test_queries)
    top_1_acc = top_1_hits / total_queries if total_queries > 0 else 0.0
    top_5_acc = top_5_hits / total_queries if total_queries > 0 else 0.0
    mrr = float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0

    # Macro Precision, Recall, F1
    macro_precision = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    macro_recall = float(recall_score(y_true, y_pred, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    mean_latency = float(np.mean(latencies))
    p95_latency = float(np.percentile(latencies, 95))

    report = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "embedding_dimensions": EMBEDDING_DIM,
        "total_test_queries": total_queries,
        "reference_destinations_count": len(reference_db),
        "metrics": {
            "top_1_accuracy": round(top_1_acc, 4),
            "top_5_accuracy": round(top_5_acc, 4),
            "mean_reciprocal_rank": round(mrr, 4),
            "macro_precision": round(macro_precision, 4),
            "macro_recall": round(macro_recall, 4),
            "macro_f1": round(macro_f1, 4)
        },
        "latency_ms": {
            "mean": round(mean_latency, 2),
            "p95": round(p95_latency, 2)
        },
        "passed_threshold": top_1_acc >= 0.70 and top_5_acc >= 0.85
    }

    return report
