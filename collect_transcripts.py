# collect_transcripts.py
# Downloads pre-extracted educational YouTube transcripts from HuggingFace
# bypassing all YouTube rate limits and bot protections!

import os
import json
import time
import subprocess
import sys
from pathlib import Path

# Ensure datasets is installed
try:
    from datasets import load_dataset
except ImportError:
    print("Installing 'datasets' library to pull transcripts instantly...")
    subprocess.run([sys.executable, "-m", "pip", "install", "datasets", "pyarrow", "pandas"], check=True)
    from datasets import load_dataset

from collections import defaultdict
import random

OUTPUT_DIR = Path("PYICE_DATA/transcripts")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TARGET_COUNT = 550

def main():
    print("Loading educational transcripts dataset from HuggingFace...")
    print("(This completely bypasses YouTube's bot detection!)")
    
    # This dataset contains high quality tech/educational transcripts
    ds = load_dataset('jamescalam/youtube-transcriptions', split='train')
    
    transcripts = defaultdict(list)
    print("Processing rows...")
    for row in ds:
        transcripts[row['video_id']].append(row['text'])
        
    all_videos = list(transcripts.items())
    random.seed(42) # predictable shuffle
    random.shuffle(all_videos)
    
    print(f"\nTotal unique videos available: {len(all_videos)}")
    print(f"Saving transcripts (target: {TARGET_COUNT})...\n")

    metadata = []
    saved_count = 0

    for video_id, texts in all_videos:
        if saved_count >= TARGET_COUNT:
            break

        # Assemble the full transcript
        full_text = " ".join(texts)
        words = full_text.split()
        
        # Skip very short videos
        if len(words) < 300:
            continue
            
        # Trim to ~4000 words max
        full_text = ' '.join(words[:4000])

        # Save transcript
        filepath = OUTPUT_DIR / f"{video_id}.txt"
        filepath.write_text(full_text, encoding='utf-8')

        metadata.append({
            "video_id": video_id,
            "word_count": len(full_text.split()),
            "file": str(filepath)
        })

        saved_count += 1
        
        # print progress
        if saved_count % 50 == 0:
            print(f"  ...saved {saved_count} transcripts")

    # Save metadata
    meta_path = Path("PYICE_DATA/metadata.json")
    meta_path.write_text(json.dumps(metadata, indent=2))

    print(f"\n✓ Saved {saved_count} transcripts to {OUTPUT_DIR}/")
    print(f"✓ Metadata saved to {meta_path}")

if __name__ == '__main__':
    main()
