"""One look at the published, human-made logic sets (run on a machine that can reach Hugging Face):
which exist, how big, what columns, a few rows. Prints; changes nothing."""
import json
import os
import sys

from huggingface_hub import HfApi, hf_hub_download

CANDIDATES = ["yale-nlp/FOLIO", "tasksource/folio", "baber/logiqa2", "tasksource/logiqa-2.0-nli", "lucasmccabe/logiqa",
              "metaeval/reclor", "tasksource/reclor", "EleutherAI/logiqa", "tasksource/ar-lsat", "hitachi-nlp/FLD.v2"]
api = HfApi()
for repo in CANDIDATES:
    print(f"=== {repo}")
    try:
        info = api.dataset_info(repo, files_metadata=True)
    except Exception as e:
        print("   not reachable:", str(e)[:120])
        continue
    print("   license:", (info.card_data or {}).get("license") if info.card_data else None, "| downloads:", info.downloads)
    files = [(s.rfilename, s.size) for s in info.siblings if s.rfilename.split(".")[-1] in ("json", "jsonl", "csv", "parquet", "tsv", "txt")]
    print("   files:", files[:12])
    shown = 0
    for name, size in files:
        if shown >= 2 or (size or 0) > 80_000_000:
            continue
        try:
            p = hf_hub_download(repo, name, repo_type="dataset", cache_dir="peek-cache")
            if name.endswith(".parquet"):
                import pandas as pd
                df = pd.read_parquet(p)
                print(f"   {name}: {len(df)} rows; columns {list(df.columns)}")
                print("   sample:", json.dumps(df.iloc[0].to_dict(), ensure_ascii=False, default=str)[:900])
            elif name.endswith((".json", ".jsonl")):
                txt = open(p, encoding="utf-8").read()
                rows = [json.loads(l) for l in txt.splitlines() if l.strip()] if name.endswith(".jsonl") or txt.lstrip()[:1] != "[" else json.loads(txt)
                print(f"   {name}: {len(rows)} rows; keys {list(rows[0].keys()) if isinstance(rows[0], dict) else type(rows[0])}")
                print("   sample:", json.dumps(rows[0], ensure_ascii=False, default=str)[:900])
            else:
                print(f"   {name}:", open(p, encoding="utf-8", errors="replace").read(500).replace("\n", " | "))
            shown += 1
        except Exception as e:
            print(f"   {name}: could not read ({str(e)[:100]})")
