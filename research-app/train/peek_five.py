"""A look at five-option, human-made question sets (run where Hugging Face is reachable). Prints; changes nothing."""
import json
from huggingface_hub import HfApi, hf_hub_download

CANDIDATES = ["lighteval/agi_eval_en", "baber/agieval", "ruixiangcui/AGIEval", "AYueksel/TurkishMMLU", "metaeval/reclor"]
api = HfApi()
for repo in CANDIDATES:
    print(f"=== {repo}")
    try:
        info = api.dataset_info(repo, files_metadata=True)
    except Exception as e:
        print("   not reachable:", str(e)[:100])
        continue
    print("   license:", (info.card_data or {}).get("license") if info.card_data else None)
    files = [(s.rfilename, s.size) for s in info.siblings]
    print("   files:", [f for f in files if not f[0].startswith(".")][:40])
