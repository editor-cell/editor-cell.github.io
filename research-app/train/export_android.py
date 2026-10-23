"""Export only the current trained checkpoint for the private Android trial.

No training and no original-model weights. The unchanged SentencePiece vocabulary
is verified against the current checkpoint's tokenizer before use on Android.
"""
import base64
import collections
import gc
import hashlib
import json
import os
import pathlib
import shutil
import zipfile

import numpy as np
from huggingface_hub import HfApi, hf_hub_download, snapshot_download

from model_state import current_model


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(4 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main():
    import torch
    import sentencepiece as spm
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    from optimum.exporters.onnx import main_export
    import onnxruntime as ort
    from onnxruntime.quantization import quantize_dynamic, QuantType
    torch.set_num_threads(4)
    root = pathlib.Path.cwd()
    state = current_model()
    api = HfApi()
    revision = state.get("revision") or api.model_info(state["repo"]).sha
    source = pathlib.Path(snapshot_download(state["repo"], revision=revision, local_dir="android-source",
        allow_patterns=["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json",
                        "special_tokens_map.json", "added_tokens.json", "spm.model"]))
    tok = AutoTokenizer.from_pretrained(source)
    config = json.loads((source / "config.json").read_text())
    labels = [config["id2label"][str(i)].lower() for i in range(3)]
    if set(labels) != {"entailment", "neutral", "contradiction"}:
        raise ValueError("Unexpected trained NLI labels")
    package = pathlib.Path("android-package")
    package.mkdir(exist_ok=True)
    # Vocabulary only; these are not a model's weights and never run inference.
    sp = source / "spm.model"
    if not sp.exists():
        sp = pathlib.Path(hf_hub_download("MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7", "spm.model"))
    shutil.copyfile(sp, package / "spm.model")
    processor = spm.SentencePieceProcessor(model_file=str(sp))
    texts = ["", "A clear paragraph about reading.", "Türkiye'de araştırma ve eğitim.",
        "İSTANBUL ı İ i I ç ş ğ ü ö", "  multiple   spaces\nnew\tline  ",
        "café cafe\u0301 ﬁnal ①", "研究と教育 العربية", "An emoji 😀 and a rocket 🚀.",
        "Growth was 3.5% in 2024; it wasn't 4%.", "A\u00a0non-breaking\u2009space."]
    for text in texts:
        if processor.encode(text) != tok.encode(text, add_special_tokens=False):
            raise ValueError("Native SentencePiece does not match the trained tokenizer: " + repr(text))
    print("::notice title=Android export::Current trained tokenizer agrees with native SentencePiece on Unicode and whitespace checks", flush=True)
    special = {"cls": tok.cls_token_id, "sep": tok.sep_token_id, "pad": tok.pad_token_id,
               "max_length": 1024, "labels": labels}
    if any(special[k] is None for k in ("cls", "sep", "pad")):
        raise ValueError("Missing pair-encoding token IDs")
    (package / "encoding.json").write_text(json.dumps(special))
    # Generic tokenizer fixtures only, with no semantic answer labels or training.
    vectors = []
    for index, text in enumerate(texts):
        hypothesis = texts[(index + 1) % len(texts)]
        encoded = tok(text, hypothesis, max_length=1024, truncation="only_first")
        vectors.append("\t".join([base64.b64encode(text.encode()).decode(), base64.b64encode(hypothesis.encode()).decode(),
            ",".join(map(str, encoded["input_ids"])), ",".join(map(str, encoded.get("token_type_ids", [0] * len(encoded["input_ids"]))))]))
    out = pathlib.Path("android-float")
    print("::notice title=Android export::Exporting the latest trained weights to ONNX", flush=True)
    main_export(str(source), output=out, task="text-classification", opset=17,
        device="cpu", do_validation=True, no_post_process=True, dynamo=False)
    float_model = out / "model.onnx"
    quantize_dynamic(str(float_model), str(package / "model.onnx"), per_channel=True,
        weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul", "Gather"])
    gc.collect()
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 4
    opts.inter_op_num_threads = 1
    float_session = ort.InferenceSession(str(float_model), sess_options=opts, providers=["CPUExecutionProvider"])
    quant_session = ort.InferenceSession(str(package / "model.onnx"), sess_options=opts, providers=["CPUExecutionProvider"])
    model = AutoModelForSequenceClassification.from_pretrained(source).eval()
    # Published questions are used only to check conversion, never to train or tune.
    import independent_exam_data as data
    questions, _ = data.build("android-exam-sources")
    questions = [q for q in questions if q["id"] not in {"2023-tyt-18", "2024-tyt-39", "lsac-lr-1", "lsac-lr-9"}]
    sample = [q for q in questions if q["group"] == "Turkish reading"][:6] + [q for q in questions if q["group"] == "English reading"][:6]
    rows = [(q["passage"], q["question"].replace("_", o) if "_" in q["question"] else q["question"] + " " + o)
            for q in sample for o in q["options"]]
    ref_logits, float_logits, quant_logits = [], [], []
    for i in range(0, len(rows), 5):
        batch = rows[i:i + 5]
        inputs = tok([p for p, _ in batch], [h for _, h in batch], truncation="only_first", max_length=1024,
                     padding=True, return_tensors="pt")
        with torch.inference_mode():
            ref_logits.extend(model(**inputs).logits.numpy())
        arrays = {k: v.numpy() for k, v in inputs.items()}
        float_logits.extend(float_session.run(None, {i.name: arrays[i.name] for i in float_session.get_inputs()})[0])
        quant_logits.extend(quant_session.run(None, {i.name: arrays[i.name] for i in quant_session.get_inputs()})[0])
    ref, floating, quant = map(np.asarray, (ref_logits, float_logits, quant_logits))
    delta_float = float(np.max(np.abs(ref - floating)))
    agreement = float(np.mean(ref.argmax(-1) == quant.argmax(-1)))
    delta_quant = float(np.max(np.abs(ref - quant)))
    ent, con = labels.index("entailment"), labels.index("contradiction")
    before = (ref[:, ent] - ref[:, con]).reshape(-1, 5).argmax(-1)
    after = (quant[:, ent] - quant[:, con]).reshape(-1, 5).argmax(-1)
    ranking_agreement = float(np.mean(before == after))
    print(f"::notice title=Android parity::float max error {delta_float:.6f}; int8 label agreement {agreement:.3f}; question ranking agreement {ranking_agreement:.3f}; int8 max error {delta_quant:.4f}", flush=True)
    if delta_float > 0.005 or agreement < 0.95 or ranking_agreement < 0.90 or delta_quant > 0.6:
        raise ValueError("Converted phone model did not preserve the trained model closely enough")
    del model, float_session
    gc.collect()
    # Dynamic length must also work at the same 1024-token limit used in training.
    long = tok("reading research evidence " * 800, "Research needs evidence.", truncation="only_first",
               max_length=1024, return_tensors="np")
    answer = quant_session.run(None, {i.name: long[i.name] for i in quant_session.get_inputs()})[0]
    if answer.shape != (1, 3) or not np.isfinite(answer).all():
        raise ValueError("Phone model failed the full-length check")
    del quant_session
    gc.collect()
    archive = pathlib.Path("android-nli.zip")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
        for name in ("model.onnx", "spm.model", "encoding.json"):
            z.write(package / name, name)
    android_repo = "orbisthereadingatlas/orbis-nli-android-" + state.get("training_run", revision[:12])
    api.create_repo(android_repo, private=True, exist_ok=True)
    api.upload_file(path_or_fileobj=str(archive), path_in_repo="android-nli.zip", repo_id=android_repo,
                    commit_message="Verified int8 Android export of the current trained NLI checkpoint")
    package_revision = api.model_info(android_repo).sha
    manifest = {"schema": 1, "title": "Orbis · son eğitilmiş model", "source_repo": state["repo"],
        "source_revision": revision, "package_repo": android_repo, "package_revision": package_revision,
        "url": f"https://huggingface.co/{android_repo}/resolve/{package_revision}/android-nli.zip",
        "bytes": archive.stat().st_size, "sha256": sha(archive), "files": {
            name: {"bytes": (package / name).stat().st_size, "sha256": sha(package / name)}
            for name in ("model.onnx", "spm.model", "encoding.json")},
        "encoding": special, "parity": {"float_max_error": delta_float, "label_agreement": agreement,
            "ranking_agreement": ranking_agreement, "quant_max_error": delta_quant}, "runtime_version": "1.23.2"}
    assets = root / "research-app/app/src/main/assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "nli_model.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    fixtures = root / "research-app/logic-test/src/test/resources"
    fixtures.mkdir(parents=True, exist_ok=True)
    (fixtures / "nli-tokenizer.tsv").write_text("\n".join(vectors) + "\n")
    shutil.copyfile(package / "spm.model", pathlib.Path("android-tokenizer-test.model"))
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
        f.write(f"## Android model export\n\n- Source: {state['repo']} at {revision}.\n- Private Android package: {android_repo}.\n- Download: {archive.stat().st_size / 1048576:.0f} MiB.\n- Label agreement: {agreement:.1%}; five-choice ranking agreement: {ranking_agreement:.1%}.\n")


if __name__ == "__main__":
    main()
