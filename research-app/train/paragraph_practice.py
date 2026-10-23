"""Kaggle entry point: at most four existing fifteen-minute training rounds."""
import glob
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time


def main():
    work = pathlib.Path("/kaggle/working")
    inputs = glob.glob("/kaggle/input/**/paragraph-practice.json", recursive=True)
    if len(inputs) != 1:
        raise ValueError("Exactly one private practice input is required")
    inp = pathlib.Path(inputs[0]).parent
    profile = json.loads(pathlib.Path(inputs[0]).read_text())
    if (inp / "round.txt").read_text().strip() != profile["run_id"]:
        raise ValueError("Stale private dataset")
    os.chdir(work)
    notes = []
    rounds = []
    start = time.monotonic()
    for number in range(1, 5):
        env = dict(os.environ)
        if number > 1:
            env["PRACTICE_START"] = str(work / "practice-next-start")
        result = subprocess.run([sys.executable, str(inp / "fast_problems.py")], env=env)
        if (work / "notes.txt").exists():
            notes.append(f"ROUND {number}, training budget 15 minutes\n" + (work / "notes.txt").read_text())
        (work / "practice-notes.txt").write_text("\n".join(notes))
        if result.returncode:
            raise RuntimeError(f"Training round {number} failed")
        status = json.loads((work / "status.json").read_text())
        if not status.get("ok") or not (work / "out" / "config.json").exists():
            raise RuntimeError("No valid experimental checkpoint")
        seen = json.loads((work / "practice-seen.json").read_text())
        rounds.append({"round": number, "unique_questions_seen": len(seen), "kept_epoch": status["epoch"]})
        if len(seen) >= 1000:
            break
        next_start = work / "practice-next-start"
        shutil.rmtree(next_start, ignore_errors=True)
        shutil.copytree(work / "out", next_start)
    completed = len(seen) == 1000
    summary = {"ok": completed, "run_id": profile["run_id"], "fingerprint": profile["fingerprint"],
        "train_questions": 1000, "unique_questions_seen": len(seen), "rounds": rounds,
        "elapsed_minutes": round((time.monotonic() - start) / 60, 2), "language": "English",
        "evaluation_only": False, "production_model_changed": False}
    (work / "status.json").write_text(json.dumps(summary))
    (work / "notes.txt").write_text("\n".join(notes) + "\n" + json.dumps(summary))
    print("PARAGRAPH PRACTICE RESULT: " + json.dumps(summary), flush=True)
    if not completed:
        raise RuntimeError("Four rounds ended before all 1000 questions were attempted; do not report completion")


if __name__ == "__main__":
    main()
