# generate_labels.py
# Sends each transcript to an API and saves (transcript, quiz_json) pairs.
# Uses any OpenAI-compatible API — Groq free tier works perfectly for this.
#
# Get a free Groq key: console.groq.com
# Install: pip install -r requirements-data.txt

import os
import json
import time
from pathlib import Path
from openai import OpenAI
from tqdm import tqdm

# ── CONFIG ─────────────────────────────────────────────────────────────────

# Use Groq free tier (14,400 requests/day — more than enough)
# Alternatively: any OpenAI-compatible API
client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.environ.get("GROQ_API_KEY"),  # set this: export GROQ_API_KEY=your_key
)

TRANSCRIPTS_DIR = Path("PYICE_DATA/transcripts")
PAIRS_DIR = Path("PYICE_DATA/pairs")
PAIRS_DIR.mkdir(parents=True, exist_ok=True)

FAILED_DIR = Path("PYICE_DATA/failed")
FAILED_DIR.mkdir(parents=True, exist_ok=True)

# ── PROMPT (same format as what your fine-tuned model will use) ──────────────

SYSTEM_PROMPT = """You are an expert educational quiz generator.
You always respond with a single valid JSON object and nothing else.
No markdown. No explanation. No code fences. Only JSON."""

def make_user_prompt(transcript):
    return f"""Generate a 7-question educational quiz from the transcript below.

Respond with ONLY this JSON:
{{
  "title": "quiz title",
  "topic": "subject area",
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why correct",
      "timestamp": 45
    }}
  ]
}}

Rules:
- Use all 4 types: mcq, true_false, fill_blank, short_answer
- mcq: 4 options, correct = index 0-3
- true_false: options = ["True","False"], correct = 0 or 1
- fill_blank: question has one [blank], 4 options
- short_answer: no options, correct = answer string
- Questions test understanding, not just memory

TRANSCRIPT:
{transcript[:3000]}"""

# ── GENERATE LABELS ─────────────────────────────────────────────────────────

def generate_quiz_for_transcript(transcript):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",  # Groq's best free model
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": make_user_prompt(transcript)}
        ],
        temperature=0.7,
        max_tokens=2000,
        response_format={"type": "json_object"},  # force JSON output
    )
    return response.choices[0].message.content


def main():
    transcript_files = sorted(TRANSCRIPTS_DIR.glob("*.txt"))
    print(f"Found {len(transcript_files)} transcripts")
    print(f"Generating quiz labels...\n")

    success = 0
    failed = 0

    for filepath in tqdm(transcript_files):
        video_id = filepath.stem
        output_path = PAIRS_DIR / f"{video_id}.json"

        # Skip if already generated
        if output_path.exists():
            success += 1
            continue

        transcript = filepath.read_text(encoding='utf-8')

        try:
            quiz_json_str = generate_quiz_for_transcript(transcript)
            quiz_data = json.loads(quiz_json_str)

            # Validate: must have 7 questions
            if len(quiz_data.get('questions', [])) < 5:
                raise ValueError(f"Only {len(quiz_data.get('questions', []))} questions generated")

            # Save the pair
            pair = {
                "video_id": video_id,
                "transcript": transcript,
                "quiz": quiz_data
            }
            output_path.write_text(json.dumps(pair, ensure_ascii=False, indent=2))
            success += 1

        except Exception as e:
            print(f"\n  ✗ Failed for {video_id}: {e}")
            (FAILED_DIR / f"{video_id}.txt").write_text(str(e))
            failed += 1

        # Rate limit: Groq free tier allows 30 req/min
        time.sleep(2)

    print(f"\n✓ Success: {success} pairs | ✗ Failed: {failed}")
    print(f"✓ Pairs saved to {PAIRS_DIR}/")


if __name__ == '__main__':
    main()
