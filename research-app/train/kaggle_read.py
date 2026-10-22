"""Runs on a free Kaggle graphics card: the NLI model reads the Quran eleven times (quran.py), then is
trained on our own examples as every other round (train_nli.py), starting from what the reading made.

Kaggle gives the files of the private dataset "orbis-train-data" (uploaded by the GitHub workflow
research-app-train-kaggle.yml) under /kaggle/input; the Quran texts are fetched here, while the
reading runs, and never stored. Everything the run leaves (the trained model in out/, notes.txt)
is collected by the same workflow, which keeps the model in a separate private Hugging Face
repository: the model the app uses is not touched.
A round may also start from an earlier round's model instead of the original one: the workflow then puts
its files in the dataset as start__<name>, and READINGS=0 skips the Quran.
Environment: READINGS (default 11), HOURS (stop reading after this many hours, default 7), HUMAN=1 to
add the human-made pairs of human.py (N_PAWS, N_TATOEBA)."""
import glob
import json
import os
import random
import shutil
import subprocess
import sys
import time

WORK = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.path.abspath("work")
SRC = os.path.join(WORK, "src")
NOTES = os.path.join(WORK, "notes.txt")
READINGS = int(os.environ.get("READINGS", "11"))
HOURS = float(os.environ.get("HOURS", "7"))
SMOKE = os.environ.get("SMOKE")  # a quick trial here: a few pairs, no paragraph round
BASE_MODEL = "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"


def note(line):
    print(line, flush=True)
    with open(NOTES, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# The dataset arrives flat (Kaggle drops folders): labels__x.jsonl is labels/x.jsonl, cases.json
# belongs in nli-trial/. Rebuild the layout train_nli.py expects.
found = glob.glob("/kaggle/input/**/pool.json", recursive=True) or [os.path.abspath("pool.json")]
inp = os.path.dirname(found[0])
os.makedirs(os.path.join(SRC, "train", "labels"), exist_ok=True)
os.makedirs(os.path.join(SRC, "nli-trial"), exist_ok=True)
START = os.path.join(WORK, "start")
for path in glob.glob(os.path.join(inp, "*")):
    name = os.path.basename(path)
    if name.startswith("start__"):
        os.makedirs(START, exist_ok=True)
        shutil.copy(path, os.path.join(START, name[len("start__"):]))
    elif name.startswith("labels__"):
        shutil.copy(path, os.path.join(SRC, "train", "labels", name[len("labels__"):]))
    elif name == "cases.json":
        shutil.copy(path, os.path.join(SRC, "nli-trial", name))
    elif os.path.isfile(path):
        shutil.copy(path, os.path.join(SRC, "train", name))
sys.path.insert(0, os.path.join(SRC, "train"))
open(NOTES, "w").close()

subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "transformers", "sentencepiece",
                "protobuf", "tiktoken"], check=False)
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import torch  # noqa: E402
from transformers import AutoModelForSequenceClassification, AutoTokenizer  # noqa: E402

if os.path.exists(os.path.join(START, "config.json")):
    BASE_MODEL = START
# The workflow marks the files it sent (round.txt: its run and the model the round should start from).
# A round that finds another run's files, or misses the model it should start from, stops here.
_round = os.path.join(inp, "round.txt")
if os.path.exists(_round):
    mark = open(_round).read().strip()
    note(f"files of run {mark}")
    if not mark.endswith("start=") and BASE_MODEL != START:
        raise SystemExit("the round should start from an earlier model, but its files are not here")

random.seed(7)
torch.manual_seed(7)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
note(f"device: {DEVICE} {torch.cuda.get_device_name(0) if DEVICE == 'cuda' else ''}")

if READINGS == 0:
    # No Quran this round: our examples go straight onto the model the round starts from.
    read_dir = BASE_MODEL
    done = 0
    note(f"no Quran reading this round, starting from "
         f"{'the earlier round' + chr(39) + 's model' if BASE_MODEL == START else BASE_MODEL}")
else:
    import quran  # noqa: E402

    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL).float().to(DEVICE)
    name_to_id = {n.lower(): i for i, n in model.config.id2label.items()}
    TO_NLI = {"SUPPORTS": "entailment", "CONTRADICTS": "contradiction", "UNRELATED": "neutral"}

    texts = quran.load(os.path.join(WORK, "quran-cache"))
    first = quran.reading(1, *texts)
    note(f"Quran: {len(first)} pairs a reading "
         f"({sum(x[2] == 'SUPPORTS' for x in first)} same judgment, {sum(x[2] == 'UNRELATED' for x in first)} different)")

    # A fixed check set: 600 pairs from a reading the model never trains on (seed 0), scored before and
    # after every reading, to show what the reading did.
    check = random.Random(0).sample(quran.reading(0, *texts), 40 if SMOKE else 600)
    if SMOKE:
        first = first[:48]


    def score(rows):
        model.eval()
        ok = 0
        with torch.no_grad():
            for i in range(0, len(rows), 32):
                part = rows[i:i + 32]
                enc = tok([p for p, _, _ in part], [h for _, h, _ in part], truncation="longest_first",
                          max_length=384, padding=True, return_tensors="pt").to(DEVICE)
                with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                    got = model(**enc).logits.argmax(-1).tolist()
                ok += sum(g == name_to_id[TO_NLI[w]] for g, (_, _, w) in zip(got, part))
        model.train()
        return f"{ok}/{len(rows)}"


    def batches(rows, size=16):
        # Pairs of like length go together, so a batch carries little padding.
        rows = rows[:]
        random.shuffle(rows)
        out = []
        for i in range(0, len(rows), size * 50):
            chunk = sorted(rows[i:i + size * 50], key=lambda r: len(r[0]) + len(r[1]))
            out += [chunk[j:j + size] for j in range(0, len(chunk), size)]
        random.shuffle(out)
        return out


    note(f"check set before reading: {score(check)} right")
    steps_total = READINGS * ((len(first) + 15) // 16)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-5, weight_decay=0.01)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / (0.06 * steps_total)) * max(0.05, 1 - s / steps_total))
    scaler = torch.amp.GradScaler(enabled=DEVICE == "cuda")
    t0 = time.time()
    done = 0
    model.train()
    for n in range(1, READINGS + 1):
        rows = first if n == 1 or SMOKE else quran.reading(n, *texts)
        losses, skipped = [], 0
        # Sixteen pairs an update, fed in halves of eight; the arithmetic in half precision on the card
        # (the weights stay in full precision, and the scaler skips a step that overflows). A T4 has
        # 16 GB: sixteen long pairs at once in full precision did not fit.
        for batch in batches(rows):
            total = None
            for half in (batch[:8], batch[8:]):
                if not half:
                    continue
                enc = tok([p for p, _, _ in half], [h for _, h, _ in half], truncation="longest_first",
                          max_length=384, padding=True, return_tensors="pt").to(DEVICE)
                labels = torch.tensor([name_to_id[TO_NLI[w]] for _, _, w in half]).to(DEVICE)
                with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                    loss = model(**enc, labels=labels).loss * len(half) / len(batch)
                if not torch.isfinite(loss):
                    total = None
                    break
                scaler.scale(loss).backward()
                total = (total or 0.0) + loss.item()
            if total is None:
                skipped += 1
                opt.zero_grad()
                continue
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            sched.step()
            opt.zero_grad()
            losses.append(total)
        done = n
        hours = (time.time() - t0) / 3600
        note(f"reading {n}: mean loss {sum(losses) / max(1, len(losses)):.3f}, {skipped} broken steps skipped, "
             f"check set {score(check)} right, {hours:.1f} hours so far")
        if hours * (n + 1) / n > HOURS and n < READINGS:
            note(f"stopped after {n} readings: the next would pass {HOURS} hours and leave no time for the paragraphs")
            break
    note(f"the Quran was read {done} times in {(time.time() - t0) / 3600:.1f} hours")

    read_dir = os.path.join(WORK, "quran-read")
    model.save_pretrained(read_dir)
    tok.save_pretrained(read_dir)
    del model, opt
    torch.cuda.empty_cache()

# Then our own examples, as every round: the same program, the same held-out tests, starting from
# the model that read the Quran. Its score card says whether the reading helped.
if SMOKE:
    sys.exit(0)
# Human-made pairs (PAWS, Tatoeba) and the rest of labels/ go into the same round.
if os.environ.get("HUMAN", "0") == "1":
    import human  # noqa: E402
    rows = human.build(int(os.environ.get("N_PAWS", "4000")), int(os.environ.get("N_TATOEBA", "3000")),
                       os.path.join(WORK, "human-cache"))
    with open(os.path.join(SRC, "train", "labels", "human.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    note(f"human-made pairs: {len(rows)} ({sum(r['label'] == 'SUPPORTS' for r in rows)} same judgment)")
env = dict(os.environ, BASE_MODEL=read_dir, OUT_DIR=os.path.join(WORK, "out"))
env.pop("HF_TOKEN", None)
proc = subprocess.run([sys.executable, os.path.join(SRC, "train", "train_nli.py"), "3", "1e-5"],
                      env=env, capture_output=True, text=True)
for line in proc.stdout.splitlines():
    if line.startswith("::notice title=Training::"):
        for part in line.split("::", 2)[2].split("%0A"):
            note(part)
if proc.returncode != 0:
    note("paragraph training failed:\n" + proc.stderr[-3000:])
if read_dir != BASE_MODEL:
    shutil.rmtree(read_dir, ignore_errors=True)
shutil.rmtree(START, ignore_errors=True)
shutil.rmtree(os.path.join(WORK, "quran-cache"), ignore_errors=True)
shutil.rmtree(os.path.join(WORK, "human-cache"), ignore_errors=True)
shutil.rmtree(SRC, ignore_errors=True)
json.dump({"readings": done, "ok": proc.returncode == 0}, open(os.path.join(WORK, "status.json"), "w"))
