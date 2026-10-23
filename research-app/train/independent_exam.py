"""Evaluation only. Reads frozen human questions and models; never trains or saves weights."""
import collections
import gc
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time


def run():
    work = pathlib.Path("/kaggle/working")
    work.mkdir(exist_ok=True)
    notes = work / "notes.txt"
    def note(s):
        print(s, flush=True)
        with notes.open("a", encoding="utf-8") as f:
            f.write(s + "\n")
    candidates = list(pathlib.Path("/kaggle/input").glob("**/exam.json"))
    if len(candidates) != 1:
        raise ValueError("Exactly one private examination dataset is required")
    inp = candidates[0].parent
    exam = json.loads(candidates[0].read_text())
    note(f"Independent exam: {len(exam['questions'])} human-written five-choice questions; fingerprint {exam['fingerprint']}")
    note("No optimizer, training, checkpoint selection or model upload. Lexical overlap screening cannot rule out pretraining exposure.")
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "transformers<5", "sentencepiece", "protobuf", "tiktoken"], check=True)
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    if not torch.cuda.is_available():
        raise RuntimeError("The free GPU was not attached; refusing a slow CPU fallback")
    device = "cuda"
    deadline = time.monotonic() + 15 * 60
    result = {"fingerprint": exam["fingerprint"], "run_id": exam["run_id"], "audit": exam["audit"], "max_length": 1024,
              "groups": dict(collections.Counter(q["group"] for q in exam["questions"])), "models": []}

    def save():
        (work / "exam-result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))

    for spec in exam["models"]:
        if time.monotonic() >= deadline:
            raise TimeoutError("15-minute evaluation budget exhausted before all models completed")
        if spec.get("prefix"):
            model_path = work / spec["name"]
            model_path.mkdir(exist_ok=True)
            for path in inp.glob(spec["prefix"] + "*"):
                shutil.copyfile(path, model_path / path.name[len(spec["prefix"]):])
            base = str(model_path)
        else:
            base = spec["repo"]
        note("Evaluating " + spec["name"])
        revision = None if spec.get("prefix") else spec["revision"]
        tok = AutoTokenizer.from_pretrained(base, revision=revision)
        model = AutoModelForSequenceClassification.from_pretrained(base, revision=revision).eval().to(device)
        ids = {v.lower(): int(k) for k, v in model.config.id2label.items()}
        if not {"entailment", "contradiction", "neutral"}.issubset(ids):
            raise ValueError("Unexpected NLI label mapping")
        rows = []
        for q in exam["questions"]:
            if len(q["options"]) != 5 or q["answer"] not in "ABCDE":
                raise ValueError("Invalid frozen examination question")
            for option in q["options"]:
                question = q["question"]
                hyp = question.replace("_", option) if "_" in question else question + " " + option
                rows.append((q["passage"], hyp))

        def score(blank=False):
            scores, truncated = [], []
            with torch.inference_mode():
                for i in range(0, len(rows), 16):
                    if time.monotonic() >= deadline:
                        raise TimeoutError("15-minute evaluation budget exhausted")
                    batch = rows[i:i+16]
                    premises = ["" if blank else p for p, _ in batch]
                    hypotheses = [h for _, h in batch]
                    lengths = tok(premises, hypotheses, truncation=False, padding=False)["input_ids"]
                    truncated += [len(a) > 1024 for a in lengths]
                    enc = tok(premises, hypotheses, truncation="only_first", max_length=1024, padding=True, return_tensors="pt").to(device)
                    with torch.autocast(device, dtype=torch.float16):
                        logits = model(**enc).logits.float()
                    ent = logits[:, ids["entailment"]]
                    # Primary score exactly matches the existing five-option trainer.
                    margin = ent - logits[:, ids["contradiction"]]
                    probability = logits.softmax(-1)[:, ids["entailment"]]
                    scores += list(zip(margin.tolist(), probability.tolist()))
            return scores, truncated

        scores, truncated = score()
        blank_scores, _ = score(blank=True)
        answers, totals = [], collections.defaultdict(lambda: [0, 0, 0, 0])
        for index, q in enumerate(exam["questions"]):
            start = index * 5
            s = scores[start:start+5]
            b = blank_scores[start:start+5]
            # Ties always select the first option; never break ties using the gold label.
            pick = max(range(5), key=lambda j: s[j][0])
            prob_pick = max(range(5), key=lambda j: s[j][1])
            blank_pick = max(range(5), key=lambda j: b[j][0])
            target = "ABCDE".index(q["answer"])
            for group in ("Overall", q["group"]):
                t = totals[group]
                t[0] += pick == target
                t[1] += 1
                t[2] += prob_pick == target
                t[3] += blank_pick == target
            answers.append({"id": q["id"], "group": q["group"], "gold": q["answer"], "prediction": "ABCDE"[pick],
                            "probability_prediction": "ABCDE"[prob_pick], "without_passage_prediction": "ABCDE"[blank_pick],
                            "scores": s, "truncated": any(truncated[start:start+5]),
                            "tied": sum(x[0] == s[pick][0] for x in s) > 1})
        summary = {g: {"correct": t[0], "total": t[1], "accuracy": round(100*t[0]/t[1], 2),
                       "entailment_probability_correct": t[2], "without_passage_correct": t[3]}
                   for g, t in totals.items()}
        one = {"name": spec["name"], "repo": spec["repo"], "revision": spec.get("revision"),
               "summary": summary, "truncated_questions": sum(a["truncated"] for a in answers),
               "tied_questions": sum(a["tied"] for a in answers), "answers": answers}
        result["models"].append(one)
        save()
        for group, t in summary.items():
            note(f"{spec['name']} | {group}: {t['correct']}/{t['total']} ({t['accuracy']:.1f}%); probability score {t['entailment_probability_correct']}/{t['total']}; without passage {t['without_passage_correct']}/{t['total']}")
        note(f"{spec['name']}: {one['truncated_questions']} truncated questions, {one['tied_questions']} tied questions")
        del model, tok
        gc.collect()
        torch.cuda.empty_cache()
        if spec.get("prefix"):
            shutil.rmtree(model_path)
    for a, b in zip(result["models"], result["models"][1:]):
        av = {q["id"]: q for q in a["answers"]}
        changes = {"improved": 0, "regressed": 0}
        for q in b["answers"]:
            old = av[q["id"]]
            before, after = old["prediction"] == old["gold"], q["prediction"] == q["gold"]
            changes["improved"] += after and not before
            changes["regressed"] += before and not after
        note(f"Paired comparison {a['name']} -> {b['name']}: {changes}")
    result["completed"] = True
    save()
    (work / "status.json").write_text(json.dumps({"ok": True, "evaluation_only": True, "run_id": exam["run_id"]}))
    note(f"Independent examination completed. {result['groups'].get('Logical reasoning', 0)} logical-reasoning questions are only a small diagnostic sample.")


if __name__ == "__main__":
    run()
