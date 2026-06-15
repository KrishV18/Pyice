# format_dataset.py
# Converts (transcript, quiz) pairs into instruction-following JSONL format
# for Unsloth + QLoRA fine-tuning.
#
# Output: PYICE_DATA/dataset_train.jsonl and dataset_val.jsonl

import json
import random
from pathlib import Path

PAIRS_DIR = Path("PYICE_DATA/pairs")
OUTPUT_DIR = Path("PYICE_DATA")

# The instruction that will always be in the training data
# (same text as your AI prompt in ai-provider.js)
INSTRUCTION = """Generate a 7-question educational quiz from the transcript below.

Respond with ONLY this JSON:
{
  "title": "quiz title",
  "topic": "subject area",
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "why correct",
      "timestamp": 45
    }
  ]
}

Rules:
- Use all 4 types: mcq, true_false, fill_blank, short_answer
- mcq: 4 options, correct = index 0-3
- true_false: options = ["True","False"], correct = 0 or 1
- fill_blank: question has one [blank], 4 options
- short_answer: no options, correct = answer string
- Questions test understanding, not just memory"""


def format_example(pair):
    """
    Format a single (transcript, quiz) pair as a Phi-3 chat example.
    Phi-3 uses this exact template format for instruction following.
    """
    transcript = pair['transcript'][:3000]
    quiz_str = json.dumps(pair['quiz'], ensure_ascii=False)

    return {
        "messages": [
            {
                "role": "system",
                "content": "You are an expert educational quiz generator. You always respond with a single valid JSON object and nothing else. No markdown. No explanation. No code fences. Only JSON."
            },
            {
                "role": "user",
                "content": f"{INSTRUCTION}\n\nTRANSCRIPT:\n{transcript}"
            },
            {
                "role": "assistant",
                "content": quiz_str
            }
        ]
    }


def main():
    pair_files = sorted(PAIRS_DIR.glob("*.json"))
    print(f"Found {len(pair_files)} pairs")

    examples = []
    for filepath in pair_files:
        try:
            pair = json.loads(filepath.read_text(encoding='utf-8'))
            # Validate: needs transcript and quiz with questions
            if not pair.get('transcript') or not pair.get('quiz', {}).get('questions'):
                continue
            formatted = format_example(pair)
            examples.append(formatted)
        except Exception as e:
            print(f"  Skipping {filepath.name}: {e}")

    # Shuffle and split 90/10 train/val
    random.shuffle(examples)
    split = int(len(examples) * 0.9)
    train_examples = examples[:split]
    val_examples = examples[split:]

    # Save as JSONL (one JSON object per line)
    train_path = OUTPUT_DIR / "dataset_train.jsonl"
    val_path = OUTPUT_DIR / "dataset_val.jsonl"

    with train_path.open('w', encoding='utf-8') as f:
        for ex in train_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    with val_path.open('w', encoding='utf-8') as f:
        for ex in val_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    print(f"\n✓ Train: {len(train_examples)} examples → {train_path}")
    print(f"✓ Val:   {len(val_examples)} examples → {val_path}")
    print("\nSample formatted example:")
    print(json.dumps(examples[0], indent=2)[:800] + "...")


if __name__ == '__main__':
    main()
