"""
TrekIndia Python AI Background Worker
Executes asynchronous batch ingestion of community posts, calculates 64-dim visual embeddings,
and updates destination-level visual knowledge in PostgreSQL.
"""
import os
import sys
import json
import time
import base64
import hashlib
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

from .config import MODEL_NAME, MODEL_VERSION, EMBEDDING_DIM
from .vision_engine import VisionEngine

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "trekindia")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        cursor_factory=RealDictCursor
    )

def process_pending_jobs(batch_size=10):
    """Fetch and execute pending visual processing jobs from database."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT job_id, post_id, job_type, attempts 
        FROM visual_processing_jobs 
        WHERE status IN ('pending', 'retrying') 
        ORDER BY created_at ASC 
        LIMIT %s
    """, (batch_size,))
    jobs = cur.fetchall()
    
    processed = 0
    for job in jobs:
        job_id = job["job_id"]
        post_id = job["post_id"]
        cur.execute("UPDATE visual_processing_jobs SET status = 'processing', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1 WHERE job_id = %s", (job_id,))
        conn.commit()
        
        try:
            # Ingest post
            cur.execute("SELECT * FROM community_posts WHERE post_id = %s", (post_id,))
            post = cur.fetchone()
            if not post:
                cur.execute("UPDATE visual_processing_jobs SET status = 'skipped', error_message = 'Post not found', completed_at = CURRENT_TIMESTAMP WHERE job_id = %s", (job_id,))
                conn.commit()
                continue
                
            images = post.get("images") or []
            if isinstance(images, str):
                try: images = json.loads(images)
                except: images = [images]
                
            for img_item in images:
                img_url = img_item if isinstance(img_item, str) else img_item.get("url")
                if not img_url: continue
                img_hash = hashlib.sha256(str(img_url).encode()).hexdigest()
                
                # Download or retrieve image features
                raw_bytes = None
                engine = VisionEngine.get_instance()
                if img_url.startswith("data:image"):
                    raw_bytes, _ = engine.clean_base64(img_url)
                elif img_url.startswith("http"):
                    try:
                        resp = requests.get(img_url, timeout=5)
                        if resp.status_code == 200:
                            raw_bytes = resp.content
                    except:
                        pass
                
                if not raw_bytes:
                    continue
                    
                feats = engine.extract_features(raw_bytes)
                
                # Insert embedding
                cur.execute("""
                    INSERT INTO trek_image_embeddings (
                        trek_id, post_id, image_url, image_hash, embedding, dimensions,
                        model_name, model_version, confidence_score, source_type, source_reliability, verification_status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'community_post', 0.75, 'verified')
                    ON CONFLICT DO NOTHING
                """, (
                    post.get("trek_id"), post_id, img_url, img_hash, feats["vector"],
                    EMBEDDING_DIM, MODEL_NAME, MODEL_VERSION, 0.85
                ))
                
            cur.execute("UPDATE visual_processing_jobs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE job_id = %s", (job_id,))
            conn.commit()
            processed += 1
        except Exception as e:
            conn.rollback()
            cur.execute("UPDATE visual_processing_jobs SET status = 'failed', error_message = %s WHERE job_id = %s", (str(e), job_id))
            conn.commit()
            
    cur.close()
    conn.close()
    return processed

if __name__ == "__main__":
    print("🚀 TrekIndia Python Visual Ingestion Worker started.")
    count = process_pending_jobs(20)
    print(f"Processed {count} background jobs successfully.")

