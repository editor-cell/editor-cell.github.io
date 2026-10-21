"""Says where the owner's Hugging Face jobs stand: stage, hardware, start time and the last log
lines of the newest ones, as notes on this run."""
from huggingface_hub import HfApi, fetch_job_logs

api = HfApi()
user = api.whoami()["name"]
all_jobs = list(api.list_jobs())
names = [r.id for r in api.list_datasets(author=user)] + [r.id for r in api.list_models(author=user)]
print(f"::notice title=Account::{user}: {len(all_jobs)} jobs; repositories: {', '.join(names) or 'none'}")
jobs = sorted(all_jobs, key=lambda j: str(j.created_at), reverse=True)[:3]
for j in jobs:
    lines = []
    try:
        for i, line in enumerate(fetch_job_logs(job_id=j.id)):
            lines.append(line)
            if i > 4000:
                break
    except Exception as e:
        lines.append(f"(logs not readable: {e})")
    tail = [l.replace("%", "%25")[:300] for l in lines[-25:]]
    print(f"::notice title=Job {j.id} {j.status.stage} on {j.flavor}, started {j.created_at}::" + "%0A".join(tail))
