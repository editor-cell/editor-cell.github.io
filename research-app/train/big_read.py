"""Paragraph reading for the app's big model (Qwen3 4B) on Kaggle's free graphics card.

Yavuz, 23 Oct 2026: the small NLI model is dropped (1,000 paragraph questions lifted its exam from 43 to 45);
the big model gets paragraph-comprehension training only, and only from questions people wrote, five options
each, as in an exam. ChatGPT runs these rounds from here on; see BUYUK-MODEL.md.

Questions (all human-made, five options, the answer published with them):
  rc  LSAT reading comprehension, all published questions of Wang et al. (2022), about 2,340: a long passage, a question
  tr  Turkish exam questions that carry a passage (AYueksel/TurkishMMLU), five options
Held out for the exam: a quarter of the passages (by a hash of the passage, as five_human.py), so a passage is
never seen in training and asked in the exam. The exam is at most EXAM questions of each kind, always the same.

The model reads: the passage, the question, options A-E, and answers with one letter (thinking switched off,
as the app does). Its choice is the letter with the highest score; chance is 20%. Training teaches the right
letter, with the options shuffled each time so it learns the answer, not a letter. Only a small add-on (LoRA)
is trained; the model itself stays as published, and the app's model file is never touched.

A round: exam before, train for MINUTES minutes, exam after. MINUTES 0 = exam only (the starting score).
START (start__* files in the dataset) = continue from an earlier round's add-on.
Leaves out/ (the add-on), notes.txt and status.json for the workflow.
Local check without a graphics card: python big_read.py data   (builds the questions, prints counts)."""
import glob
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time

WORK = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.path.abspath("work")
os.makedirs(WORK, exist_ok=True)
NOTES = os.path.join(WORK, "notes.txt")
BASE = os.environ.get("BASE", "Qwen/Qwen3-4B")
EXAM = int(os.environ.get("EXAM", "60"))       # per kind: 60 English + 60 Turkish = 120 questions
MAXLEN = int(os.environ.get("MAXLEN", "1600"))  # tokens; longer questions are left out
LR = float(os.environ.get("LR", "1e-4"))
ACCUM = int(os.environ.get("ACCUM", "8"))
LETTERS = "ABCDE"
open(NOTES, "w").close()


def note(line):
    print(line, flush=True)
    with open(NOTES, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def read_setting(inp, name, default=""):
    p = os.path.join(inp, name + ".txt")
    return open(p).read().strip() if os.path.exists(p) else default


# ---------- the questions ----------

def held_out(passage):
    return int(hashlib.md5(passage.encode()).hexdigest(), 16) % 4 == 0


def clean(option):
    return re.sub(r"^\([A-E]\)\s*", "", str(option).strip())


LSAT_ROOT = "https://raw.githubusercontent.com/zhongwanjun/AR-LSAT/41f78ca7be3e24602b694b9d6b78105fc0c8bfc6/complete_lsat_data/"


def lsat_rc(cache):
    """All published LSAT reading questions of Wang et al., From LSAT (2022): about 2,370, five options each."""
    import urllib.request
    os.makedirs(cache, exist_ok=True)
    out, seen = [], set()
    for split in ("train", "val", "test"):
        path = os.path.join(cache, f"lsat-{split}-rc.json")
        if not os.path.exists(path):
            urllib.request.urlretrieve(LSAT_ROOT + f"{split}_rc.json", path)
        for r in json.load(open(path, encoding="utf-8")):
            options = r["answers"] if isinstance(r["answers"], list) else json.loads(r["answers"])
            options = [clean(o) for o in options]
            if len(options) != 5 or str(r["label"]) not in "01234":
                continue
            passage = re.sub(r"\s+", " ", str(r["context"])).strip()
            key = (passage, str(r["question"]).strip())
            if key in seen:
                continue
            seen.add(key)
            out.append({"kind": "rc", "qid": f"rc-{r['id_string']}", "passage": passage, "question": key[1],
                        "options": options, "answer": int(r["label"]), "dev": held_out(passage)})
    return out


def split_stem(stem):
    """A Turkish exam stem is passage + question in one string; the question is its last sentence."""
    t = re.sub(r"\s+", " ", stem).strip()
    if len(t) < 300:
        return None
    cut = max(t[:-1].rfind(". "), t[:-1].rfind("! "), t[:-1].rfind("? "))
    if cut < 0:
        return None
    passage, question = t[:cut + 1].strip(), t[cut + 2:].strip()
    if len(passage) < 150 or len(question) < 8:
        return None
    return passage, question


def turkish(cache):
    import pandas as pd
    from huggingface_hub import hf_hub_download, list_repo_files
    out = []
    files = sorted(x for x in list_repo_files("AYueksel/TurkishMMLU", repo_type="dataset")
                   if x.endswith(".json") and x.startswith(("dev/", "test/")))
    for f in files:
        data = pd.read_json(hf_hub_download("AYueksel/TurkishMMLU", f, repo_type="dataset", cache_dir=cache)).to_dict("records")
        for k, r in enumerate(data):
            options = [str(o).strip() for o in r["choices"]]
            if len(options) != 5 or str(r["answer"]) not in LETTERS:
                continue
            parts = split_stem(str(r["question"]))
            if parts is None:
                continue
            passage, question = parts
            out.append({"kind": "tr", "qid": f"tr-{f}-{k}", "passage": passage, "question": question,
                        "options": options, "answer": LETTERS.index(str(r["answer"])), "dev": held_out(passage)})
    return out


def questions(cache):
    qs = lsat_rc(cache) + turkish(cache)
    train = [q for q in qs if not q["dev"]]
    exam = []
    for kind in ("rc", "tr"):
        pool = sorted((q for q in qs if q["dev"] and q["kind"] == kind), key=lambda q: hashlib.md5(q["qid"].encode()).hexdigest())
        exam += pool[:EXAM]
    return train, exam


def prompt(q, order=None):
    order = order or list(range(5))
    lines = [f"{LETTERS[i]}) {q['options'][j]}" for i, j in enumerate(order)]
    if q["kind"] == "tr":
        head = "Aşağıdaki paragrafı okuyun ve soruyu cevaplayın. Yalnız doğru şıkkın harfini yazın."
        body = f"Paragraf:\n{q['passage']}\n\nSoru: {q['question']}\n\n" + "\n".join(lines) + "\n\nCevap:"
    else:
        head = "Read the passage and answer the question. Reply with the letter of the correct option only."
        body = f"Passage:\n{q['passage']}\n\nQuestion: {q['question']}\n\n" + "\n".join(lines) + "\n\nAnswer:"
    return head + "\n\n" + body


# ---------- the model ----------

def main():
    found = glob.glob("/kaggle/input/**/big_round.txt", recursive=True)
    inp = os.path.dirname(found[0]) if found else os.path.abspath(".")
    note("files of run " + read_setting(inp, "big_round", "(local)"))
    minutes = float(read_setting(inp, "minutes", "15") or 0)
    start = os.path.join(WORK, "start")
    for path in glob.glob(os.path.join(inp, "start__*")):
        os.makedirs(start, exist_ok=True)
        shutil.copy(path, os.path.join(start, os.path.basename(path)[len("start__"):]))
    has_start = os.path.exists(os.path.join(start, "adapter_config.json"))

    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-U", "transformers>=4.51", "peft", "bitsandbytes", "accelerate"], check=True)
    import torch
    from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    t0 = time.time()
    train, exam = questions(os.path.join(WORK, "cache"))
    tok = AutoTokenizer.from_pretrained(BASE)

    def encode(q, order=None):
        msgs = [{"role": "user", "content": prompt(q, order)}]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        return tok(text, add_special_tokens=False)["input_ids"]

    letter_ids = [tok.encode(c, add_special_tokens=False)[0] for c in LETTERS]
    train = [q for q in train if len(encode(q)) <= MAXLEN]
    exam = [q for q in exam if len(encode(q)) <= MAXLEN]
    note(f"questions: training {len(train)} (English {sum(q['kind'] == 'rc' for q in train)}, Turkish {sum(q['kind'] == 'tr' for q in train)}); "
         f"exam {len(exam)} (English {sum(q['kind'] == 'rc' for q in exam)}, Turkish {sum(q['kind'] == 'tr' for q in exam)}), 5 options, chance 20%")

    model = AutoModelForCausalLM.from_pretrained(
        BASE, device_map={"": 0}, torch_dtype=torch.float16,
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                               bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True))
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)
    if has_start:
        model = PeftModel.from_pretrained(model, start, is_trainable=True)
        note("starting from the earlier round's add-on: " + read_setting(inp, "start", "?"))
    else:
        model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                                                 target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]))
        note("starting from the model as published (no add-on)")

    def scores(ids):
        x = torch.tensor([ids], device="cuda")
        logits = model(input_ids=x).logits[0, -1].float()
        return logits[letter_ids]

    def run_exam(title):
        model.eval()
        right = {"rc": [0, 0], "tr": [0, 0]}
        with torch.no_grad():
            for q in exam:
                pick = int(scores(encode(q)).argmax())
                right[q["kind"]][0] += pick == q["answer"]
                right[q["kind"]][1] += 1
        r, n = sum(v[0] for v in right.values()), sum(v[1] for v in right.values())
        parts = ", ".join(f"{'English (LSAT)' if k == 'rc' else 'Turkish'} {v[0]}/{v[1]}" for k, v in right.items() if v[1])
        note(f"EXAM {title}: {r}/{n} = {100 * r / max(n, 1):.1f}% ({parts})")
        model.train()
        return r / max(n, 1)

    before = run_exam("before")
    after, steps = before, 0
    if minutes > 0 and train:
        rnd = random.Random(int(read_setting(inp, "seed", "3") or 3))
        opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=LR)
        model.train()
        t_train = time.time()
        seen, loss_sum = 0, 0.0
        while time.time() - t_train < minutes * 60:
            rnd.shuffle(train)
            for q in train:
                if time.time() - t_train >= minutes * 60:
                    break
                order = list(range(5))
                rnd.shuffle(order)
                target = order.index(q["answer"])
                loss = torch.nn.functional.cross_entropy(scores(encode(q, order)).unsqueeze(0), torch.tensor([target], device="cuda")) / ACCUM
                loss.backward()
                loss_sum += loss.item() * ACCUM
                seen += 1
                if seen % ACCUM == 0:
                    torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
                    opt.step()
                    opt.zero_grad()
                    steps += 1
                    if steps % 10 == 0:
                        note(f"  {seen} questions read, mean loss {loss_sum / seen:.3f}, {(time.time() - t_train) / 60:.1f} min")
        opt.zero_grad()
        note(f"trained {(time.time() - t_train) / 60:.1f} minutes: {seen} questions read ({seen / max(len(train), 1):.2f} times the training set)")
        after = run_exam("after")

    out = os.path.join(WORK, "out")
    model.save_pretrained(out)
    note(f"kept the add-on ({'better' if after > before else 'not better'} than before: {100 * before:.1f}% -> {100 * after:.1f}%); "
         f"whole round {(time.time() - t0) / 60:.0f} minutes")
    json.dump({"ok": True, "before": before, "after": after, "improved": after > before}, open(os.path.join(WORK, "status.json"), "w"))


if __name__ == "__main__":
    if sys.argv[1:] == ["data"]:
        tr, ex = questions(os.path.join(WORK, "cache"))
        print(f"training {len(tr)}, exam {len(ex)}")
        for q in (tr[:1] + [q for q in tr if q["kind"] == "tr"][:1]):
            print("\n" + prompt(q)[:1200] + f"\n=> {LETTERS[q['answer']]}")
    else:
        try:
            main()
        except Exception as e:
            import traceback
            note("ERROR: " + "".join(traceback.format_exception(e))[-3000:])
            json.dump({"ok": False}, open(os.path.join(WORK, "status.json"), "w"))
            raise
