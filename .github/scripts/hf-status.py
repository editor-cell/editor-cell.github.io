"""Says where the owner's Hugging Face jobs stand: stage, hardware, start time and the last log
lines of the newest ones, as notes on this run. Logs are read for at most 40 seconds a job,
because the log of a running job is followed, not just read."""
import threading

from huggingface_hub import HfApi, fetch_job_logs

api = HfApi()
user = api.whoami()["name"]
all_jobs = list(api.list_jobs())
names = [r.id for r in api.list_datasets(author=user)] + [r.id for r in api.list_models(author=user)]
print(f"::notice title=Account::{user}: {len(all_jobs)} jobs; repositories: {', '.join(names) or 'none'}", flush=True)
for j in sorted(all_jobs, key=lambda j: str(j.created_at), reverse=True)[:3]:
    print(f"::notice title=Job stage::{j.id} {j.status.stage} on {j.flavor}, created {j.created_at}", flush=True)
    lines = []

    def read():
        try:
            for line in fetch_job_logs(job_id=j.id):
                lines.append(line)
        except Exception as e:
            lines.append(f"(logs not readable: {e})")

    t = threading.Thread(target=read, daemon=True)
    t.start()
    t.join(40)
    tail = [l.replace("%", "%25")[:300] for l in lines[-30:]]
    print(f"::notice title=Job log, last lines::" + ("%0A".join(tail) or "(empty)"), flush=True)
