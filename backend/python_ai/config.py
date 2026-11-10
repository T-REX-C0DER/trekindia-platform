"""
TrekIndia Python AI Microservice Configuration
Local Computer Vision & Multimodal Trek Recognition Engine
Zero external paid API dependencies.
"""
import os

MODEL_NAME = "trekindia-vision-mobilenet-v3"
MODEL_VERSION = "2.0.0"
PREPROCESSING_VERSION = "2.0.0"
EMBEDDING_DIM = 576  # MobileNetV3-Small deep pooling feature dimension

AI_SERVICE_HOST = os.getenv("PYTHON_AI_HOST", "127.0.0.1")
AI_SERVICE_PORT = int(os.getenv("PYTHON_AI_PORT", "8001"))

# Confidence Calibration Thresholds
CONFIDENCE_THRESHOLD_STRONG = 0.78       # Strong high-confidence match
CONFIDENCE_THRESHOLD_POSSIBLE = 0.60     # Plausible candidate match
CONFIDENCE_THRESHOLD_REJECTION = 0.48    # Below this: honest rejection to "Similar Landscape"

# Perceptual & Terrain Archetypes for Indian Trails
ARCHETYPE_LABELS = [
    "High-Altitude Snow Peak & Glaciated Ridge",
    "Alpine Bugyal & Sub-Alpine Meadow",
    "Sahyadri Basalt Escarpment & Fort Trail",
    "Dense Himalayan Coniferous Forest (Deodar/Pine)",
    "Glacial Valley & Bouldered Riverbed",
    "Exposed Granite Ridge & Rocky Col",
    "Western Ghats Rainforest & Shola Grassland",
    "Arid Trans-Himalayan Cold Desert (Spiti/Ladakh)",
    "Monsoon Mist Waterfall & Stream Trail",
    "Sub-Tropical Foothill Woodland (Oak/Rhododendron)"
]

# Supported image MIME types
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff"
}
