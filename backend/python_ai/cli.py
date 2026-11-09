"""
TrekIndia Python AI CLI Utility
Allows running feature extraction directly via CLI or child_process
without network port binding.
"""
import sys
import json
import base64
from backend.python_ai.image_processor import clean_base64, extract_visual_features

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--health':
        print(json.dumps({"status": "ok", "service": "trekindia-python-ai"}))
        return

    # Read base64 input from stdin
    input_data = sys.stdin.read().strip()
    if not input_data:
        print(json.dumps({"success": False, "error": "No input received via stdin"}))
        sys.exit(1)

    try:
        raw_bytes, img_hash = clean_base64(input_data)
        features = extract_visual_features(raw_bytes)
        features["success"] = True
        features["hash"] = img_hash
        print(json.dumps(features))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

