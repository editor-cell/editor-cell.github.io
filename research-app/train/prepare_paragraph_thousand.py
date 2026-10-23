"""Prepare a private input for the existing fifteen-minute trainer."""
import json
import os
import pathlib
import shutil

from huggingface_hub import HfApi, snapshot_download
import pandas as pd

from independent_exam_data import build, download
from paragraph_thousand import select, labels


def main():
    train_dir = pathlib.Path(__file__).resolve().parent
    target = pathlib.Path("practice-private")
    target.mkdir(exist_ok=True)
    candidates, _ = build("practice-source-cache")
    protected = [q["passage"] for q in candidates]
    # Same published source used by the previous five-choice rounds, including
    # their held-out questions and the extra three demonstration questions.
    for split in ("train", "validation"):
        url = f"https://huggingface.co/datasets/lighteval/agi_eval_en/resolve/main/lsat-rc/{split}-00000-of-00001.parquet"
        path = pathlib.Path("practice-source-cache") / f"old-{split}.parquet"
        download(url, path)
        protected.extend(pd.read_parquet(path)["passage"].tolist())
    dataset = select("practice-source-cache", protected)
    frozen = json.loads((train_dir / "paragraph_thousand_manifest.json").read_text())
    if dataset["manifest"] != frozen:
        raise ValueError("Published source/selection changed; frozen 1000-question manifest does not match")
    (target / "paragraph-practice.json").write_text(json.dumps({"run_id": os.environ["GITHUB_RUN_ID"],
        "fingerprint": __import__("paragraph_thousand").fingerprint(frozen), "labels": labels(dataset)}, ensure_ascii=False))
    for name in ("pool.json", "fast_problems.py"):
        shutil.copyfile(train_dir / name, target / name)
    shutil.copyfile(train_dir.parent / "nli-trial" / "cases.json", target / "cases.json")
    (target / "round.txt").write_text(os.environ["GITHUB_RUN_ID"])
    (target / "focus.txt").write_text("fivehuman")
    (target / "minutes.txt").write_text("15")
    # Only this private experiment is continued; the production model is untouched.
    model = "orbisthereadingatlas/orbis-nli-bes-sik-1"
    files = HfApi().list_repo_files(model)
    weights = "model.safetensors" if "model.safetensors" in files else "pytorch_model.bin"
    source = pathlib.Path(snapshot_download(model, local_dir="practice-start-download",
        allow_patterns=[weights, "config.json", "tokenizer.json", "tokenizer_config.json",
                        "special_tokens_map.json", "added_tokens.json", "spm.model"]))
    for f in source.iterdir():
        if f.is_file() and not f.name.startswith("."):
            shutil.copyfile(f, target / ("start__" + f.name))
    report = pathlib.Path("practice-report")
    report.mkdir(exist_ok=True)
    (report / "data-audit.json").write_text(json.dumps(frozen, indent=2))
    print("::notice title=Paragraph practice::" + json.dumps(frozen["counts"]) + "; published English LSAT reading questions, no generated answers", flush=True)


if __name__ == "__main__":
    main()
