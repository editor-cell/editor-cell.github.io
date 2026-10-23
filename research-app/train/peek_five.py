"""A look at AGIEval's five-option LSAT sets (run where Hugging Face is reachable). Prints; changes nothing."""
import json
import pandas as pd
from huggingface_hub import hf_hub_download

for cfg in ("lsat-rc", "lsat-lr", "lsat-ar", "sat-en", "logiqa-en"):
    for split in ("train", "validation"):
        p = hf_hub_download("lighteval/agi_eval_en", f"{cfg}/{split}-00000-of-00001.parquet", repo_type="dataset", cache_dir="peek-cache")
        df = pd.read_parquet(p)
        print(f"=== {cfg} {split}: {len(df)} rows; columns {list(df.columns)}")
        if split == "train":
            print(json.dumps(df.iloc[0].to_dict(), ensure_ascii=False, default=lambda x: x.tolist() if hasattr(x, 'tolist') else str(x))[:1800])
            lens = [len(str(x)) for x in df[df.columns[0]]]
            print("   first-column length (chars) mean/max:", sum(lens) // len(lens), max(lens))
