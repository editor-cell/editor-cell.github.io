"""Prepare a private, frozen examination and screen all known training sources."""
import collections
import glob
import hashlib
import json
import os
import pathlib
import shutil

import independent_exam_data as data


def prior_texts(root, cache):
    import pandas as pd
    from huggingface_hub import hf_hub_download, list_repo_files
    def fetch(repo, filename):
        return hf_hub_download(repo, filename, repo_type="dataset", cache_dir=str(cache))
    for path in (root / "research-app/train/labels").glob("*.jsonl"):
        for line in path.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                yield " ".join(str(r.get(k) or "") for k in ("premise", "en", "tr"))
    for p in json.loads((root / "research-app/train/pool.json").read_text()):
        yield p["text"]
    import five_human
    for r in five_human.build(str(cache / "five")):
        yield r["premise"] + " " + r["en"]
    # Include the completed 1000-question course in the overlap audit, too.
    from paragraph_thousand import read_source
    course_manifest = json.loads((root / "research-app/train/paragraph_thousand_manifest.json").read_text())
    course_rows, source_hash = read_source("train", cache / "paragraph-course")
    if source_hash != course_manifest["source_hashes"]["train"]:
        raise ValueError("The completed course source changed")
    for r in course_rows:
        if r["id_string"] in course_manifest["train"]:
            yield r["context"] + " " + r["question"]
    # Include every original Turkish stem, even if a later trainer removed it or
    # changed its passage splitter. An earlier round may still have seen it.
    for filename in list_repo_files("AYueksel/TurkishMMLU", repo_type="dataset"):
        if filename.endswith(".json") and filename.startswith(("dev/", "test/")):
            for r in pd.read_json(fetch("AYueksel/TurkishMMLU", filename)).to_dict("records"):
                yield str(r["question"]) + " " + " ".join(r["choices"])
    # Screen the whole RACE pool, not just the latest training seed/sample.
    for cfg in ("middle", "high"):
        for split in ("train", "validation", "test"):
            frame = pd.read_parquet(fetch("ehovy/race", f"{cfg}/{split}-00000-of-00001.parquet"))
            for article in frame["article"].unique():
                yield article
    for lang in ("eng_Latn", "tur_Latn"):
        path = fetch("facebook/belebele", f"data/{lang}.jsonl")
        for line in pathlib.Path(path).read_text().splitlines():
            r = json.loads(line)
            yield r["flores_passage"] + " " + r["question"]
    for split in ("train", "validation"):
        for line in pathlib.Path(fetch("tasksource/folio", f"folio_v2_{split}.jsonl")).read_text().splitlines():
            r = json.loads(line)
            yield r["premises"] + " " + r["conclusion"]
        for line in pathlib.Path(fetch("tasksource/logiqa-2.0-nli", f"{split}.jsonl")).read_text().splitlines():
            r = json.loads(line)
            yield r["premise"] + " " + r["hypothesis"]


def main():
    from huggingface_hub import HfApi, snapshot_download
    root = pathlib.Path.cwd()
    target = root / "exam-private"
    target.mkdir(exist_ok=True)
    rows, hashes = data.build(root / "exam-source-cache")
    manifest = json.loads((pathlib.Path(__file__).parent / "independent_exam_manifest.json").read_text())
    for name, expected in manifest["expected_source_hashes"].items():
        if hashes[name] != expected:
            raise ValueError("The source PDF changed; review required: " + name)
    if {q["id"] for q in rows} != set(manifest["questions"]):
        raise ValueError("Frozen source selection changed")
    for q in rows:
        canonical = json.dumps({k: q[k] for k in ("id", "passage", "question", "options", "answer")},
                               ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if hashlib.sha256(canonical.encode()).hexdigest() != manifest["questions"][q["id"]]["sha256"]:
            raise ValueError("Question extraction differs from the reviewed source: " + q["id"])
    print("Frozen source selection verified: " + str(len(rows)), flush=True)
    # This question refers to underlining that a plain-text input cannot preserve.
    layout_excluded = {"2024-tyt-39": "requires an underlined phrase absent from the plain-text input"}
    rows = [q for q in rows if q["id"] not in layout_excluded]
    rows, audit = data.overlap_audit(rows, prior_texts(root, root / "exam-audit-cache"))
    audit["layout_excluded"] = layout_excluded
    audit["source_hashes"] = hashes
    audit["checked_sources"] = ["all repository labels and paragraph pool", "AGIEval LSAT including held-out questions",
                                "TurkishMMLU used by the trainer", "all RACE train/validation/test articles",
                                "Belebele English and Turkish", "FOLIO and LogiQA NLI train/validation"]
    if {q["id"] for q in rows} != set(manifest["questions"]) - {"2023-tyt-18", "2024-tyt-39", "lsac-lr-1", "lsac-lr-9"}:
        raise ValueError("Too few independent questions remain; no silent replacement")
    print("Overlap audit: " + json.dumps(audit, ensure_ascii=False), flush=True)
    run_id = os.environ["GITHUB_RUN_ID"]
    api = HfApi()
    from model_state import current_model
    state = current_model()
    # Evaluate only the newest trained checkpoint. Compare with recorded scores;
    # never rerun the original or earlier checkpoints (Yavuz, 23 Oct 2026).
    models = []
    names = [("latest-trained", state["repo"], True)]
    for label, name, required in names:
        repo = name
        if not api.repo_exists(repo):
            if required:
                raise ValueError("Required comparison model is unavailable: " + name)
            print("Second round not yet available; evaluate it in a later run.", flush=True)
            continue
        revision = state.get("revision") or api.model_info(repo).sha
        folder = pathlib.Path(snapshot_download(repo, revision=revision, local_dir=str(root / "exam-models" / label),
                                               allow_patterns=["*.json", "*.safetensors", "*.bin", "*.model", "tokenizer*", "vocab.*", "merges.txt"]))
        prefix = "model__" + label + "__"
        for path in folder.iterdir():
            if path.is_file() and not path.name.startswith("."):
                shutil.copyfile(path, target / (prefix + path.name))
        models.append({"name": label, "repo": repo, "revision": revision, "prefix": prefix})
    fingerprint = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    exam = {"run_id": run_id, "questions": rows, "fingerprint": fingerprint, "audit": audit, "models": models}
    (target / "exam.json").write_text(json.dumps(exam, ensure_ascii=False))
    (target / "round.txt").write_text(run_id)
    # Public Actions artifacts contain no question/passage/option text and no weights.
    report = root / "exam-report"
    report.mkdir(exist_ok=True)
    (report / "exam-audit.json").write_text(json.dumps({"run_id": run_id, "fingerprint": fingerprint, "audit": audit,
        "groups": dict(collections.Counter(q["group"] for q in rows)), "models": models,
        "question_ids": [q["id"] for q in rows]}, ensure_ascii=False, indent=2))
    print("Prepared " + str(len(rows)) + " questions; models: " + ", ".join(m["name"] for m in models), flush=True)


if __name__ == "__main__":
    main()
