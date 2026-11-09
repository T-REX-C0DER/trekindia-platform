"""
TrekIndia Python Image Processing & Perceptual Feature Extractor
Generates standardized 64-dimensional normalized visual feature vectors directly from images
without external cloud API dependencies.
"""
import io
import re
import base64
import hashlib
import numpy as np
from PIL import Image, ImageStat, ImageFilter
from .config import ARCHETYPE_LABELS, EMBEDDING_DIM, MODEL_NAME, MODEL_VERSION

def clean_base64(data_uri_or_base64: str) -> tuple[bytes, str]:
    """Clean base64 data URI header and return decoded raw image bytes and hash."""
    clean = re.sub(r"^data:image/[a-zA-Z]+;base64,", "", data_uri_or_base64.strip())
    raw_bytes = base64.b64decode(clean)
    img_hash = hashlib.sha256(raw_bytes).hexdigest()
    return raw_bytes, img_hash

def extract_visual_features(raw_bytes: bytes) -> dict:
    """
    Analyzes image using spatial, spectral, color-histogram and edge-detection moments.
    Produces a calibrated 64-dimensional feature vector aligned with ARCHETYPE_LABELS.
    """
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    width, height = img.size
    aspect_ratio = width / max(1, height)
    
    # 1. Resize to canonical 224x224 patch grid
    img_canonical = img.resize((224, 224), Image.Resampling.BILINEAR)
    np_img = np.array(img_canonical, dtype=np.float32) / 255.0  # (224, 224, 3)
    
    # 2. Color moments & channel statistics
    r, g, b = np_img[:, :, 0], np_img[:, :, 1], np_img[:, :, 2]
    r_mean, g_mean, b_mean = np.mean(r), np.mean(g), np.mean(b)
    r_std, g_std, b_std = np.std(r), np.std(g), np.std(b)
    
    # Perceptual indicators
    brightness = 0.299 * r_mean + 0.587 * g_mean + 0.114 * b_mean
    contrast = np.std(0.299 * r + 0.587 * g + 0.114 * b)
    
    # Whiteness / Snow ratio (high R, G, B with low saturation)
    snow_mask = (r > 0.65) & (g > 0.65) & (b > 0.65) & (np.abs(r - g) < 0.12) & (np.abs(g - b) < 0.12)
    snow_ratio = float(np.mean(snow_mask))
    
    # Greenery / Vegetation ratio (G significantly higher than R and B)
    green_mask = (g > r * 1.08) & (g > b * 1.08) & (g > 0.25)
    green_ratio = float(np.mean(green_mask))
    
    # Azure Sky / Water ratio (B higher than R and G, especially in upper half)
    sky_mask = (b > r * 1.15) & (b > g * 1.05) & (b > 0.45)
    sky_upper_ratio = float(np.mean(sky_mask[:112, :]))
    water_lower_ratio = float(np.mean(sky_mask[112:, :]))
    
    # Earth / Rock / Basalt ratio (Warm browns or neutral dark grays)
    rock_mask = (np.abs(r - g) < 0.15) & (r < 0.55) & (g < 0.55) & (b < 0.55)
    rock_ratio = float(np.mean(rock_mask))
    
    # 3. Spatial division: 4 quadrants (top-left, top-right, bottom-left, bottom-right)
    q1 = np_img[:112, :112]
    q2 = np_img[:112, 112:]
    q3 = np_img[112:, :112]
    q4 = np_img[112:, 112:]
    quadrant_means = [float(np.mean(q)) for q in [q1, q2, q3, q4]]
    
    # 4. Gradient / Edge analysis (identifies rugged crags vs smooth skies)
    gray = img_canonical.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_density = float(np.mean(np.array(edges)) / 255.0)
    
    # 5. Synthesize calibrated 64-dimensional archetype vector
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    
    # Terrain & Geomorphology (0-15)
    vec[0] = snow_ratio * 1.4                       # snow_peak
    vec[1] = (snow_ratio * 0.7 + edge_density * 0.5) # glaciated_ridge
    vec[2] = rock_ratio * 0.8                       # scree_slope
    vec[3] = edge_density * 1.2 * (1.0 - snow_ratio) # granite_crag
    vec[4] = sky_upper_ratio * 0.6 + edge_density * 0.4 # alpine_pass
    vec[5] = contrast * 0.9 * (1.0 - sky_upper_ratio) # deep_gorge
    vec[6] = green_ratio * 0.5 + rock_ratio * 0.4   # glacial_valley
    vec[7] = rock_ratio * 0.9                       # moraine_scree
    vec[8] = (1.0 - edge_density) * green_ratio    # plateau_tableland
    vec[9] = edge_density * rock_ratio * 1.2        # escarpment
    vec[10] = rock_ratio * (1.0 - green_ratio)      # volcanic_basalt
    vec[11] = water_lower_ratio * 0.7 + rock_ratio * 0.5 # river_canyon
    vec[12] = edge_density * 0.6                    # saddle_col
    vec[13] = snow_ratio * 0.6 + rock_ratio * 0.5   # cirque_basin
    vec[14] = water_lower_ratio * 0.9               # tarn_basin
    vec[15] = edge_density * 0.8 + sky_upper_ratio * 0.5 # summit_crest
    
    # Vegetation & Ecology (16-31)
    vec[16] = green_ratio * 1.2 * (1.0 - snow_ratio) # pine_deodar_forest
    vec[17] = green_ratio * 0.8 + (r_mean * 0.4)    # rhododendron_woods
    vec[18] = green_ratio * 1.5 * (1.0 - edge_density) # alpine_bugyal_meadow
    vec[19] = green_ratio * 0.9                     # oak_conifer_belt
    vec[20] = rock_ratio * 0.6 + snow_ratio * 0.4   # high_altitude_tundra
    vec[21] = green_ratio * 1.3 * (1.0 - snow_ratio) # shola_grassland
    vec[22] = green_ratio * 0.8 + water_lower_ratio * 0.6 # monsoon_wetland
    vec[23] = green_ratio * 0.7                     # bamboo_thicket
    vec[24] = (1.0 - snow_ratio) * green_ratio * 0.8 # deciduous_foothill
    vec[25] = rock_ratio * 0.5 + green_ratio * 0.3  # juniper_scrub
    vec[26] = green_ratio * 0.8 + (r_mean * 0.5)    # wildflower_carpet
    vec[27] = green_ratio * 0.6 + snow_ratio * 0.4  # subalpine_birch
    vec[28] = (1.0 - green_ratio) * rock_ratio * 0.7 # dry_scrub_thorn
    vec[29] = green_ratio * 1.1 + water_lower_ratio * 0.4 # mossy_rainforest
    vec[30] = green_ratio * 0.9                     # tea_plantation_terrace
    vec[31] = green_ratio * 0.8 + (1.0 - edge_density) * 0.4 # agricultural_terrace
    
    # Water & Atmospheric (32-47)
    vec[32] = water_lower_ratio * 1.5               # glacial_tarn_lake
    vec[33] = water_lower_ratio * 0.9 + rock_ratio * 0.5 # braided_riverbed
    vec[34] = water_lower_ratio * 1.2 + edge_density * 0.4 # rushing_cascade
    vec[35] = water_lower_ratio * 1.4 + edge_density * 0.6 # high_waterfall
    vec[36] = (1.0 - contrast) * 0.8 * brightness   # monsoon_mist
    vec[37] = (1.0 - contrast) * 1.1                # dense_fog_cloudsea
    vec[38] = r_mean * 1.3 * (1.0 - green_ratio)    # alpenglow_light
    vec[39] = sky_upper_ratio * 1.4                 # crisp_azure_sky
    vec[40] = (1.0 - brightness) * contrast * 1.1   # monsoon_stormcloud
    vec[41] = snow_ratio * 1.2 + edge_density * 0.5 # frozen_icefall
    vec[42] = rock_ratio * 0.8 + snow_ratio * 0.6   # permafrost_tundra
    vec[43] = water_lower_ratio * 0.6               # mineral_thermal_spring
    vec[44] = (r_mean + g_mean * 0.5) * 0.8         # dusk_crepuscular_rays
    vec[45] = snow_ratio * 1.3 + rock_ratio * 0.5   # pristine_glacier_snout
    vec[46] = snow_ratio * 1.4 + edge_density * 0.4 # snow_cornice
    vec[47] = snow_ratio * 0.9 + edge_density * 0.7 # avalanche_chute
    
    # Cultural & Infrastructure (48-63)
    vec[48] = rock_ratio * 1.1 * edge_density       # ancient_hill_fort
    vec[49] = rock_ratio * 0.9                      # stone_chorten_cairn
    vec[50] = sky_upper_ratio * 0.5 + contrast * 0.5 # prayer_flag_ridge
    vec[51] = water_lower_ratio * 0.7 + edge_density * 0.5 # wooden_bridge_rope
    vec[52] = rock_ratio * 0.5 + green_ratio * 0.4  # remote_himalayan_hamlet
    vec[53] = green_ratio * 0.4 + contrast * 0.5    # pitched_tent_camp
    vec[54] = rock_ratio * 0.8                      # shepherd_stone_hut
    vec[55] = edge_density * 0.8 + rock_ratio * 0.6 # steep_stone_stairway
    vec[56] = edge_density * 0.5 + green_ratio * 0.3 # flagged_trail_path
    vec[57] = edge_density * 1.3                    # exposed_cliff_traverse
    vec[58] = rock_ratio * 0.6 + green_ratio * 0.3  # mule_caravan_track
    vec[59] = green_ratio * 0.6                     # forest_checkpoint
    vec[60] = edge_density * 1.2 + rock_ratio * 0.7 # iron_ladder_scramble
    vec[61] = green_ratio * 0.5 + rock_ratio * 0.4  # timber_homestay
    vec[62] = rock_ratio * 1.2 * (1.0 - sky_upper_ratio) # boulder_cave_bivy
    vec[63] = edge_density * 0.9 + sky_upper_ratio * 0.6 # sacred_temple_peak
    
    # Base smoothing & minimum activation
    vec = np.clip(vec, 0.05, 1.0)
    
    # Unit L2 normalization
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    
    # Find dominant visual characteristics
    top_indices = np.argsort(vec)[::-1][:4]
    dominant_features = [ARCHETYPE_LABELS[i].replace("_", " ").title() for i in top_indices]
    
    # Detect primary landscape archetype
    if snow_ratio > 0.25:
        archetype = "High-Altitude Snow & Glacial Alpine"
    elif green_ratio > 0.35 and rock_ratio > 0.25:
        archetype = "Western Ghats / Sahyadri Escarpment"
    elif green_ratio > 0.40:
        archetype = "Lush Himalayan Valley & Conifer Belt"
    elif water_lower_ratio > 0.30:
        archetype = "Alpine Glacial Tarn & River Basin"
    elif rock_ratio > 0.40:
        archetype = "Rugged Rocky Scree & Mountain Crag"
    else:
        archetype = "Temperate Mountain Trail"
        
    return {
        "vector": vec.tolist(),
        "dimensions": EMBEDDING_DIM,
        "dominant_features": dominant_features,
        "terrain_archetype": archetype,
        "metrics": {
            "snow_ratio": round(snow_ratio, 3),
            "green_ratio": round(green_ratio, 3),
            "sky_ratio": round(sky_upper_ratio, 3),
            "rock_ratio": round(rock_ratio, 3),
            "edge_density": round(edge_density, 3),
            "aspect_ratio": round(aspect_ratio, 2)
        }
    }