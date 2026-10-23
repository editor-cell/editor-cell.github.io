"""Submit/collect an independent evaluation or explicit paragraph practice.

Uses a separate private dataset per Actions run and never replaces checkpoints.
Credentials remain on the Actions host, just as in the existing training workflow.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time
import zipfile


def command(*args, check=True, capture=False):
    return subprocess.run(args, check=check, text=True, stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.STDOUT if capture else None)


def gpu_slots_full(message):
    return "maximum batch gpu session count" in str(message).lower()


def main():
    practice = os.environ.get("PARAGRAPH_PRACTICE") == "1"
    title = "Paragraph practice" if practice else "Independent exam"
    report_dir = "practice-report" if practice else "exam-report"
    for key in ("KAGGLE_KEY", "KAGGLE_API_TOKEN", "KAGGLE_USERNAME"):
        if not os.environ.get(key):
            os.environ.pop(key, None)
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    username = os.environ.get("KAGGLE_USERNAME") or api.config_values.get("username") or getattr(api, "username", "")
    if not username:
        raise ValueError("Kaggle account name could not be resolved from the existing connection")
    os.environ["KAGGLE_USERNAME"] = username
    run_id = os.environ["GITHUB_RUN_ID"]
    slug = ("orbis-paragraph-1000-" if practice else "orbis-independent-exam-") + run_id
    dataset = username + "/" + slug
    kernel_slug = slug + "-run"
    kernel = username + "/" + kernel_slug
    target = pathlib.Path("practice-private" if practice else "exam-private")
    (target / "dataset-metadata.json").write_text(json.dumps({"title": slug, "id": dataset, "licenses": [{"name": "other"}]}))
    # The upload endpoint occasionally returns an empty/non-JSON response.
    # Retrying the same private run is safe; never replace another run's data.
    for attempt in range(3):
        uploaded = command("kaggle", "datasets", "create", "-p", str(target), "-q", check=False, capture=True)
        if uploaded.returncode == 0:
            print(uploaded.stdout.strip(), flush=True)
            break
        existing = command("kaggle", "datasets", "status", dataset, check=False, capture=True)
        if existing.returncode == 0:
            # The exact round marker is still checked below before any kernel runs.
            break
        if attempt == 2:
            raise RuntimeError("Private Kaggle upload failed after three attempts: " + uploaded.stdout[-1800:])
        print(f"::notice title={title} upload::Retrying an interrupted private dataset upload ({attempt + 1}/3).", flush=True)
        time.sleep(10)

    # Read this exact run marker back; no shared training dataset is changed.
    ready = False
    for _ in range(60):
        mark = pathlib.Path("exam-mark")
        mark.mkdir(exist_ok=True)
        command("kaggle", "datasets", "download", dataset, "-f", "round.txt", "-p", str(mark), "-q", "--force", check=False, capture=True)
        z = mark / "round.txt.zip"
        if z.exists():
            with zipfile.ZipFile(z) as archive:
                (mark / "round.txt").write_bytes(archive.read("round.txt"))
        if (mark / "round.txt").exists() and (mark / "round.txt").read_text().strip() == run_id:
            ready = True
            break
        time.sleep(20)
    if not ready:
        raise TimeoutError("Private examination dataset did not become ready within 20 minutes")
    kk = pathlib.Path("exam-kernel")
    kk.mkdir(exist_ok=True)
    program = "paragraph_practice.py" if practice else "independent_exam.py"
    shutil.copyfile("research-app/train/" + program, kk / program)
    metadata = {"id": kernel, "title": kernel_slug, "code_file": program,
        "language": "python", "kernel_type": "script", "is_private": True,
        "enable_gpu": True, "enable_internet": True, "machine_shape": "NvidiaTeslaT4",
        "dataset_sources": [dataset], "competition_sources": [], "kernel_sources": []}
    slot_deadline = time.monotonic() + 80 * 60
    attempt = 0
    while True:
        attempt += 1
        # A quota-rejected save can leave an unusable slug; use a fresh name on
        # the next attempt. No existing training notebook is stopped or edited.
        candidate = kernel_slug if attempt == 1 else kernel_slug + f"-q{attempt:02d}"
        kernel = username + "/" + candidate
        metadata.update(id=kernel, title=candidate)
        (kk / "kernel-metadata.json").write_text(json.dumps(metadata))
        detail, pushed = "", None
        try:
            pushed = api.kernels_push(str(kk))
            detail = str(pushed.error) if pushed is not None and pushed.error else ""
        except Exception as exc:
            response = getattr(exc, "response", None)
            detail = getattr(response, "text", "") or str(exc)
            # Show the server's error body, never request headers or credentials.
            for env_key, value in os.environ.items():
                if value and len(value) >= 8 and any(t in env_key for t in ("TOKEN", "KEY", "SECRET")):
                    detail = detail.replace(value, "[redacted]")
        if not detail and pushed is not None:
            break
        if not gpu_slots_full(detail):
            raise RuntimeError("Kaggle notebook submission failed: " + (detail or "empty response")[:2500])
        print(f"::notice title={title} queue::Waiting for a free GPU slot; existing training sessions are left running.", flush=True)
        report = pathlib.Path(report_dir)
        report.mkdir(exist_ok=True)
        (report / "queue-status.json").write_text(json.dumps({"status": "waiting_for_gpu", "run_id": run_id,
            "attempt": attempt, "reason": "Maximum batch GPU session count reached"}))
        if time.monotonic() + 120 >= slot_deadline:
            raise TimeoutError("No GPU slot became available within 80 minutes; no training session was interrupted")
        time.sleep(120)
    invalid = list(getattr(pushed, "invalidDatasetSources", []) or [])
    if invalid:
        raise RuntimeError("Kaggle rejected the private examination dataset source")
    (pathlib.Path(report_dir) / "queue-status.json").write_text(json.dumps({"status": "submitted", "run_id": run_id, "kernel": kernel}))
    print(f"::notice title={title}::Sent to the free Kaggle GPU: " + kernel, flush=True)
    end = time.monotonic() + (105 if practice else 30) * 60
    final_status = ""
    while time.monotonic() < end:
        state = command("kaggle", "kernels", "status", kernel, capture=True, check=False).stdout
        print(state.strip(), flush=True)
        if any(word in state.lower() for word in ("complete", "error", "cancel")):
            final_status = state
            break
        time.sleep(30)
    if not final_status:
        raise TimeoutError("The Kaggle queue/evaluation is still pending after 30 minutes: " + kernel)
    res = pathlib.Path("exam-collected")
    command("kaggle", "kernels", "output", kernel, "-p", str(res), "-q", check=False)
    report = pathlib.Path(report_dir)
    report.mkdir(exist_ok=True)
    notes = (res / "notes.txt").read_text() if (res / "notes.txt").exists() else "No examination notes."
    print(f"::notice title={title}::" + notes.replace("\n", "%0A")[:12000], flush=True)
    for name in ("notes.txt", "status.json", "exam-result.json"):
        if (res / name).exists():
            shutil.copyfile(res / name, report / name)
    status = json.loads((res / "status.json").read_text()) if (res / "status.json").exists() else {}
    if practice:
        profile = json.loads((target / "paragraph-practice.json").read_text())
        if (not status.get("ok") or status.get("run_id") != run_id
            or status.get("fingerprint") != profile["fingerprint"]
            or status.get("unique_questions_seen") != 1000 or status.get("evaluation_only")
            or not (res / "out" / "config.json").exists()):
            for path in res.glob("*.log"):
                print(path.read_text(errors="replace")[-6000:])
            raise RuntimeError("The 1000-question practice did not complete; no checkpoint published")
        from huggingface_hub import HfApi
        hf = HfApi()
        repository = "orbisthereadingatlas/orbis-nli-paragraf-bin-" + run_id
        hf.create_repo(repository, private=True, exist_ok=False)
        hf.upload_folder(repo_id=repository, folder_path=str(res / "out"), commit_message="Human-written five-choice paragraph practice; separate experimental checkpoint")
        from model_state import record_latest
        record_latest(repository, hf.model_info(repository).sha)
        status["private_checkpoint"] = repository
        (report / "status.json").write_text(json.dumps(status, indent=2))
        counts = json.loads((report / "data-audit.json").read_text())["counts"]
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("## Bin soruluk paragraf çalışması\n\n")
            f.write(f"- Yayımlanmış cevap anahtarlı, beş şıklı 1000 İngilizce LSAT sorusu; {counts['train_passages']} farklı metin.\n")
            f.write("- Kontrol: eğitimden ayrı 100 soru; bağımsız 97 soru eğitimde kullanılmadı.\n")
            f.write(f"- Tamamlanan farklı soru: {status['unique_questions_seen']}/1000. Turlar: {len(status['rounds'])}.\n")
            f.write(f"- Özel deney modeli: {repository}.\n")
            f.write("- Üretimde kullanılan model değiştirilmedi.\n")
        return
    if not status.get("ok") or status.get("run_id") != run_id or not status.get("evaluation_only"):
        for path in res.glob("*.log"):
            print(path.read_text(errors="replace")[-6000:])
        raise RuntimeError("The independent examination did not complete successfully")
    result = json.loads((res / "exam-result.json").read_text())
    expected = json.loads((target / "exam.json").read_text())
    if result["fingerprint"] != expected["fingerprint"] or not result.get("completed"):
        raise ValueError("Examination fingerprint/result mismatch")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write("## Bağımsız sınav\n\n")
        f.write("- Yalnız değerlendirme yapıldı; model ağırlıkları değiştirilmedi.\n")
        f.write("- Sorular: " + json.dumps(result["groups"], ensure_ascii=False) + "\n")
        for model in result["models"]:
            for group, score in model["summary"].items():
                f.write(f"- {model['name']} / {group}: {score['correct']}/{score['total']} (%{score['accuracy']:.1f}); metinsiz kontrol: {score['without_passage_correct']}/{score['total']}\n")
        f.write("- Mantık bölümü küçük bir örneklemdir. Eğitim öncesi model maruziyeti dışlanamaz.\n")


if __name__ == "__main__":
    main()
