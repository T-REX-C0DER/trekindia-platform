"""
TrekIndia Python AI CLI Utility
Allows direct child process feature extraction and evaluation.
"""
import sys
import json
from .vision_engine import VisionEngine
from .evaluator import run_evaluation_benchmark

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--evaluate":
        report = run_evaluation_benchmark()
        print(json.dumps(report, indent=2))
        sys.exit(0)

    # Read base64 input from stdin
    input_data = sys.stdin.read().strip()
    if not input_data:
        print(json.dumps({"success": False, "error": "No input provided on stdin"}))
        sys.exit(1)

    try:
        engine = VisionEngine.get_instance()
        raw_bytes, img_hash = engine.clean_base64(input_data)
        analysis = engine.extract_features(raw_bytes)
        output = {
            "success": True,
            "hash": img_hash,
            "vector": analysis["vector"],
            "dimensions": analysis["dimensions"],
            "dominant_features": analysis["dominant_features"],
            "terrain_archetype": analysis["terrain_archetype"],
            "metrics": analysis["metrics"],
            "model_name": analysis["model_name"],
            "model_version": analysis["model_version"]
        }
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
