"""A look at TurkishMMLU (five options, Turkish exam questions). Run where Hugging Face is reachable. Prints; changes nothing."""
import json
import pandas as pd
from huggingface_hub import HfApi, hf_hub_download

REPO = "AYueksel/TurkishMMLU"
files = HfApi().list_repo_files(REPO, repo_type="dataset")
print("FILES:", files[:60])
for f in files:
    if not f.endswith((".parquet", ".csv", ".json", ".jsonl")):
        continue
    p = hf_hub_download(REPO, f, repo_type="dataset", cache_dir="peek-cache")
    if f.endswith(".parquet"):
        df = pd.read_parquet(p)
    elif f.endswith(".csv"):
        df = pd.read_csv(p)
    else:
        df = pd.read_json(p, lines=f.endswith(".jsonl"))
    n_par = sum(1 for q in df["question"] if len(str(q)) > 350) if "question" in df else -1
    print(f"=== {f}: {len(df)} rows; cols {list(df.columns)}; questions>350 chars: {n_par}")
    if "Literature" in f or "Language" in f:
        print(json.dumps(df.iloc[0].to_dict(), ensure_ascii=False, default=lambda x: x.tolist() if hasattr(x, 'tolist') else str(x))[:1500])
