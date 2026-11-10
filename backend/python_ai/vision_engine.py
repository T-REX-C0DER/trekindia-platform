"""
TrekIndia Deep Vision Engine
PyTorch MobileNetV3-Small Deep Feature Extractor and Perceptual Analyzer
Extracts 576-dimensional normalized visual embeddings and environmental metrics directly from image pixels.
Runs 100% locally with zero paid API dependencies.
"""
import io
import re
import sys
import base64
import hashlib
from typing import Tuple, Dict, Any, List
import numpy as np
from PIL import Image, ImageFilter, ImageStat
import torch
import torchvision.models as models
import torchvision.transforms as transforms

from .config import (
    MODEL_NAME, MODEL_VERSION, EMBEDDING_DIM, ARCHETYPE_LABELS
)

class VisionEngine:
    _instance = None

    def __init__(self):
        self.device = torch.device("cpu")
        print(f"[VisionEngine] Initializing deep vision backbone ({MODEL_NAME} {MODEL_VERSION}) on {self.device}...", file=sys.stderr)
        
        # Load MobileNetV3-Small with default pretrained weights
        weights = models.MobileNet_V3_Small_Weights.DEFAULT
        full_model = models.mobilenet_v3_small(weights=weights)
        full_model.eval()

        # Extract feature backbone (everything up to final classification layer)
        self.features = full_model.features
        self.avgpool = full_model.avgpool
        # Freeze all weights for inference
        for param in self.features.parameters():
            param.requires_grad = False

        # Standard ImageNet normalization pipeline
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        print("[VisionEngine] Deep vision backbone ready. 576-dim feature pooling active.", file=sys.stderr)

    @classmethod
    def get_instance(cls) -> "VisionEngine":
        if cls._instance is None:
            cls._instance = VisionEngine()
        return cls._instance

    @staticmethod
    def clean_base64(data_uri_or_base64: str) -> Tuple[bytes, str]:
        """Strip data URI header if present and return raw bytes + SHA256 hash."""
        clean = re.sub(r"^data:image/[a-zA-Z0-9\+\-\.]+;base64,", "", data_uri_or_base64.strip())
        clean = re.sub(r"\s+", "", clean)
        raw_bytes = base64.b64decode(clean)
        img_hash = hashlib.sha256(raw_bytes).hexdigest()
        return raw_bytes, img_hash

    @staticmethod
    def compute_perceptual_metrics(pil_img: Image.Image) -> Dict[str, Any]:
        """
        Analyze physical pixel distributions: snow, vegetation, sky, rock/earth,
        contrast, and sharpness.
        """
        rgb_img = pil_img.convert("RGB")
        img_small = rgb_img.resize((160, 160), Image.Resampling.BILINEAR)
        arr = np.array(img_small, dtype=np.float32) / 255.0

        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        r_mean, g_mean, b_mean = float(np.mean(r)), float(np.mean(g)), float(np.mean(b))

        # Perceptual luminance & contrast
        luminance = 0.299 * r + 0.587 * g + 0.114 * b
        brightness = float(np.mean(luminance))
        contrast = float(np.std(luminance))

        # Snow mask: high brightness, low color saturation
        snow_mask = (r > 0.65) & (g > 0.65) & (b > 0.65) & (np.abs(r - g) < 0.10) & (np.abs(g - b) < 0.10)
        snow_ratio = float(np.mean(snow_mask))

        # Vegetation mask: green dominant over red and blue
        green_mask = (g > r * 1.08) & (g > b * 1.05) & (g > 0.20)
        green_ratio = float(np.mean(green_mask))

        # Sky mask in top half of image
        sky_mask_top = (b[:80, :] > r[:80, :] * 1.15) & (b[:80, :] > g[:80, :] * 1.05) & (b[:80, :] > 0.40)
        sky_ratio = float(np.mean(sky_mask_top))

        # Rock / Earth mask: brownish/dark grey neutral tones
        rock_mask = (r > g) & (g >= b) & (r < 0.60) & (b < 0.45) & (~green_mask)
        rock_ratio = float(np.mean(rock_mask))

        # Edge sharpness
        gray = img_small.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_energy = float(np.mean(np.array(edges, dtype=np.float32)) / 255.0)

        # Perceptual hash for near-duplicate identification (64-bit dHash)
        thumb = gray.resize((9, 8), Image.Resampling.BILINEAR)
        pixels = list(thumb.getdata())
        difference = []
        for row in range(8):
            for col in range(8):
                pixel_left = pixels[row * 9 + col]
                pixel_right = pixels[row * 9 + col + 1]
                difference.append(pixel_left > pixel_right)
        decimal_value = 0
        hex_string = []
        for index, value in enumerate(difference):
            if value:
                decimal_value += 2 ** (index % 8)
            if (index % 8) == 7:
                hex_string.append(hex(decimal_value)[2:].rjust(2, '0'))
                decimal_value = 0
        dhash = "".join(hex_string)

        return {
            "brightness": round(brightness, 3),
            "contrast": round(contrast, 3),
            "snow_ratio": round(snow_ratio, 3),
            "green_ratio": round(green_ratio, 3),
            "sky_ratio": round(sky_ratio, 3),
            "rock_ratio": round(rock_ratio, 3),
            "edge_energy": round(edge_energy, 3),
            "perceptual_dhash": dhash
        }

    def infer_archetype_and_dominant_features(
        self, metrics: Dict[str, float], vector: np.ndarray
    ) -> Tuple[str, List[str]]:
        """
        Synthesize terrain archetype and dominant features from deep features and metrics.
        """
        snow = metrics["snow_ratio"]
        green = metrics["green_ratio"]
        rock = metrics["rock_ratio"]
        sky = metrics["sky_ratio"]
        edge = metrics["edge_energy"]

        dominant = []
        if snow > 0.15:
            dominant.append("Glacial Snowpack / Snow Summit")
        if green > 0.35:
            dominant.append("Lush Alpine Meadow / Grassland")
        elif green > 0.18:
            dominant.append("Pine / Conifer Forest Cover")
        if rock > 0.25 or edge > 0.22:
            dominant.append("Rugged Granite Crags / Basalt Ridges")
        if sky > 0.30:
            dominant.append("Expansive Open Horizon / Mountain Pass")

        if not dominant:
            dominant = ["Mountain Trail", "Wilderness Valley"]

        # Determine dominant archetype
        if snow >= 0.25:
            archetype = ARCHETYPE_LABELS[0]  # High-Altitude Snow Peak
        elif green >= 0.40 and edge < 0.20:
            archetype = ARCHETYPE_LABELS[1]  # Alpine Bugyal
        elif rock >= 0.30 and green < 0.25 and edge >= 0.20:
            archetype = ARCHETYPE_LABELS[2]  # Sahyadri Basalt Escarpment
        elif green >= 0.25 and edge >= 0.20:
            archetype = ARCHETYPE_LABELS[3]  # Coniferous Forest
        elif rock >= 0.25 and snow >= 0.08:
            archetype = ARCHETYPE_LABELS[4]  # Glacial Valley
        elif edge >= 0.25:
            archetype = ARCHETYPE_LABELS[5]  # Exposed Granite Ridge
        elif green >= 0.45:
            archetype = ARCHETYPE_LABELS[6]  # Western Ghats Rainforest
        elif rock >= 0.35 and green < 0.08 and snow < 0.05:
            archetype = ARCHETYPE_LABELS[7]  # Arid Cold Desert
        elif green >= 0.30 and metrics["brightness"] > 0.45:
            archetype = ARCHETYPE_LABELS[8]  # Monsoon Mist Waterfall Trail
        else:
            archetype = ARCHETYPE_LABELS[9]  # Sub-Tropical Foothill Woodland

        return archetype, dominant[:4]

    def extract_features(self, raw_bytes: bytes) -> Dict[str, Any]:
        """
        Executes full deep-learning feature extraction pipeline:
        1. Decode image bytes with Pillow.
        2. Compute perceptual metrics.
        3. Preprocess with transforms (256 resize, 224 center crop, ImageNet normalize).
        4. Pass through MobileNetV3-Small features + avgpool.
        5. Flatten and L2-normalize to unit vector (norm = 1.0).
        """
        try:
            pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        except Exception as e:
            raise ValueError(f"Failed to decode image: {str(e)}")

        # Compute physical pixel metrics
        metrics = self.compute_perceptual_metrics(pil_img)

        # PyTorch Tensor inference
        input_tensor = self.transform(pil_img).unsqueeze(0).to(self.device)  # (1, 3, 224, 224)

        with torch.no_grad():
            x = self.features(input_tensor)
            x = self.avgpool(x)  # (1, 576, 1, 1)
            raw_vec = torch.flatten(x, 1).squeeze(0).cpu().numpy()  # (576,)

        # L2 unit normalization
        norm = float(np.linalg.norm(raw_vec))
        if norm > 0:
            norm_vec = raw_vec / norm
        else:
            norm_vec = raw_vec

        vector_list = [round(float(v), 5) for v in norm_vec]

        archetype, dominant_features = self.infer_archetype_and_dominant_features(metrics, norm_vec)

        return {
            "vector": vector_list,
            "dimensions": EMBEDDING_DIM,
            "dominant_features": dominant_features,
            "terrain_archetype": archetype,
            "metrics": metrics,
            "model_name": MODEL_NAME,
            "model_version": MODEL_VERSION
        }
