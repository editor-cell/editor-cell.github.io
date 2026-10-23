"""Submit/collect the evaluation in the existing free Kaggle account.

Uses a separate private dataset per Actions run and never uploads model weights.
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


def main():
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
    slug = "orbis-independent-exam-" + run_id
    dataset = username + "/" + slug
    kernel_slug = slug + "-run"
    kernel = username + "/" + kernel_slug
    target = pathlib.Path("exam-private")
    (target / "dataset-metadata.json").write_text(json.dumps({"title": slug, "id": dataset, "licenses": [{"name": "other"}]}))
    command("kaggle", "datasets", "create", "-p", str(target), "-q")
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
    shutil.copyfile("research-app/train/independent_exam.py", kk / "independent_exam.py")
    (kk / "kernel-metadata.json").write_text(json.dumps({"id": kernel, "title": kernel_slug, "code_file": "independent_exam.py",
        "language": "python", "kernel_type": "script", "is_private": True,
        "enable_gpu": True, "enable_internet": True, "machine_shape": "NvidiaTeslaT4",
        "dataset_sources": [dataset], "competition_sources": [], "kernel_sources": []}))
    try:
        pushed = api.kernels_push(str(kk))
    except Exception as exc:
        response = getattr(exc, "response", None)
        detail = getattr(response, "text", "") or str(exc)
        # Show the server's error body, never request headers or credentials.
        for env_key, value in os.environ.items():
            if value and len(value) >= 8 and any(t in env_key for t in ("TOKEN", "KEY", "SECRET")):
                detail = detail.replace(value, "[redacted]")
        print("Kaggle notebook submission failed: " + detail[:2500], flush=True)
        raise RuntimeError("Kaggle rejected the examination notebook") from None
    if pushed is None or pushed.error:
        raise RuntimeError("Kaggle notebook submission error: " + str(getattr(pushed, "error", "empty response")))
    invalid = list(getattr(pushed, "invalidDatasetSources", []) or [])
    if invalid:
        raise RuntimeError("Kaggle rejected the private examination dataset source")
    print("::notice title=Independent exam::Sent to the free Kaggle GPU: " + kernel, flush=True)
    end = time.monotonic() + 85 * 60
    final_status = ""
    while time.monotonic() < end:
        state = command("kaggle", "kernels", "status", kernel, capture=True, check=False).stdout
        print(state.strip(), flush=True)
        if any(word in state.lower() for word in ("complete", "error", "cancel")):
            final_status = state
            break
        time.sleep(30)
    if not final_status:
        raise TimeoutError("The Kaggle queue/evaluation is still pending after 85 minutes: " + kernel)
    res = pathlib.Path("exam-collected")
    command("kaggle", "kernels", "output", kernel, "-p", str(res), "-q", check=False)
    report = pathlib.Path("exam-report")
    report.mkdir(exist_ok=True)
    notes = (res / "notes.txt").read_text() if (res / "notes.txt").exists() else "No examination notes."
    print("::notice title=Independent exam::" + notes.replace("\n", "%0A")[:12000], flush=True)
    for name in ("notes.txt", "status.json", "exam-result.json"):
        if (res / name).exists():
            shutil.copyfile(res / name, report / name)
    status = json.loads((res / "status.json").read_text()) if (res / "status.json").exists() else {}
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
