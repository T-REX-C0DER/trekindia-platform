"""
TrekIndia Python AI Engine - Configuration & Metadata
Zero-paid-API policy: Uses local open-source Python vision, Scikit-learn, and Pillow models.
"""
import os
from pydantic import BaseModel

AI_SERVICE_PORT = int(os.getenv("PYTHON_AI_PORT", "5050"))
AI_SERVICE_HOST = os.getenv("PYTHON_AI_HOST", "127.0.0.1")
MODEL_NAME = "trekindia-python-vit-v1"
MODEL_VERSION = "v1.0.0"
EMBEDDING_DIM = 64

# Archetype labels encoding 64 semantic and perceptual visual features of Indian mountain landscapes
ARCHETYPE_LABELS = [
    # Terrain & geomorphology (0-15)
    "snow_peak", "glaciated_ridge", "scree_slope", "granite_crag", "alpine_pass", 
    "deep_gorge", "glacial_valley", "moraine_scree", "plateau_tableland", "escarpment", 
    "volcanic_basalt", "river_canyon", "saddle_col", "cirque_basin", "tarn_basin", "summit_crest",
    
    # Vegetation & Ecology (16-31)
    "pine_deodar_forest", "rhododendron_woods", "alpine_bugyal_meadow", "oak_conifer_belt", 
    "high_altitude_tundra", "shola_grassland", "monsoon_wetland", "bamboo_thicket", 
    "deciduous_foothill", "juniper_scrub", "wildflower_carpet", "subalpine_birch", 
    "dry_scrub_thorn", "mossy_rainforest", "tea_plantation_terrace", "agricultural_terrace",
    
    # Water & Atmospheric (32-47)
    "glacial_tarn_lake", "braided_riverbed", "rushing_cascade", "high_waterfall", 
    "monsoon_mist", "dense_fog_cloudsea", "alpenglow_light", "crisp_azure_sky", 
    "monsoon_stormcloud", "frozen_icefall", "permafrost_tundra", "mineral_thermal_spring", 
    "dusk_crepuscular_rays", "pristine_glacier_snout", "snow_cornice", "avalanche_chute",
    
    # Cultural, Human & Trekking Infrastructure (48-63)
    "ancient_hill_fort", "stone_chorten_cairn", "prayer_flag_ridge", "wooden_bridge_rope", 
    "remote_himalayan_hamlet", "pitched_tent_camp", "shepherd_stone_hut", "steep_stone_stairway", 
    "flagged_trail_path", "exposed_cliff_traverse", "mule_caravan_track", "forest_checkpoint", 
    "iron_ladder_scramble", "timber_homestay", "boulder_cave_bivy", "sacred_temple_peak"
]

