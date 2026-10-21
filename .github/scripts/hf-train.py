"""Runs train_nli.py on a Hugging Face graphics card (Jobs) and brings its notes back to this run.

The training files go to a private dataset repository on the owner's account; the job downloads
them, trains, and saves the model to a private model repository. Only the minutes the job runs are
paid. Usage: hf-train.py <flavor> <epochs> <learning rate>"""
import os
import sys
import time

from huggingface_hub import HfApi, fetch_job_logs, inspect_job, run_job

flavors, epochs, lr = sys.argv[1].split(","), sys.argv[2], sys.argv[3]
api = HfApi()
# A job still waiting for a card from an earlier run is cancelled; nothing is paid while it waits.
for old in api.list_jobs():
    if old.status.stage in ("SCHEDULING", "RUNNING"):
        api.cancel_job(job_id=old.id)
        print(f"::notice title=Graphics card job::cancelled the earlier job {old.id} ({old.status.stage})", flush=True)
user = api.whoami()["name"]
data_repo = f"{user}/orbis-train-data"
model_repo = f"{user}/orbis-nli-mdeberta"

api.create_repo(data_repo, repo_type="dataset", private=True, exist_ok=True)
api.upload_folder(repo_id=data_repo, repo_type="dataset", folder_path="research-app/train",
                  path_in_repo="train", allow_patterns=["train_nli.py", "pool.json", "labels/*.jsonl"])
api.upload_file(repo_id=data_repo, repo_type="dataset", path_or_fileobj="research-app/nli-trial/cases.json",
                path_in_repo="nli-trial/cases.json")

script = (
    "pip install --quiet transformers sentencepiece protobuf tiktoken huggingface_hub && "
    "python -c \"from huggingface_hub import snapshot_download; "
    f"snapshot_download('{data_repo}', repo_type='dataset', local_dir='/work')\" && "
    f"cd /work && python train/train_nli.py {epochs} {lr}"
)
# Cards are not always free: if one has not started within five minutes, try the next.
job = None
for flavor in flavors:
    job = run_job(
        image="pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime",
        command=["bash", "-c", script],
        flavor=flavor,
        timeout="1h",
        secrets={"HF_TOKEN": os.environ["HF_TOKEN"]},
        env={"HUB_REPO": model_repo, "OUT_DIR": "/work/out"},
    )
    print(f"::notice title=Graphics card job::asked for {flavor} ({job.id})", flush=True)
    waited = 0
    while inspect_job(job_id=job.id).status.stage == "SCHEDULING" and waited < 300:
        time.sleep(15)
        waited += 15
    if inspect_job(job_id=job.id).status.stage != "SCHEDULING":
        print(f"::notice title=Graphics card job::running on {flavor}", flush=True)
        break
    api.cancel_job(job_id=job.id)
    print(f"::notice title=Graphics card job::no {flavor} free after five minutes, trying the next", flush=True)
else:
    print("::error title=Graphics card job::no graphics card was free", flush=True)
    sys.exit(1)

seen = 0
while True:
    stage = inspect_job(job_id=job.id).status.stage
    try:
        lines = list(fetch_job_logs(job_id=job.id)) if stage in ("COMPLETED", "ERROR", "CANCELED", "DELETED") else []
    except Exception:
        lines = []
    for line in lines[seen:]:
        print(line, flush=True)
    seen = max(seen, len(lines))
    if stage in ("COMPLETED", "ERROR", "CANCELED", "DELETED"):
        break
    time.sleep(30)
print(f"::notice title=Graphics card job::{stage}", flush=True)
sys.exit(0 if stage == "COMPLETED" else 1)
