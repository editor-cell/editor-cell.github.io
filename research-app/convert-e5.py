"""Converts intfloat/multilingual-e5-small to GGUF with llama.cpp's converter.

The model is a BERT network with an XLM-RoBERTa tokenizer (sentencepiece). llama.cpp's converter
handles that tokenizer only for XLM-RoBERTa networks, whose word positions start after the padding
token; this one's start at 0. So the BERT path is used, with the XLM-RoBERTa tokenizer and without
the position shift.

Usage: python convert-e5.py <llama.cpp dir> <model dir> <out file>
"""
import sys
from pathlib import Path

llama, model_dir, out = sys.argv[1:4]
sys.path.insert(0, llama)

from conversion.bert import BertModel  # noqa: E402

_plain_vocab = BertModel.set_vocab


def set_vocab(self):
    if (Path(self.dir_model) / "sentencepiece.bpe.model").is_file():
        return self._xlmroberta_set_vocab()
    return _plain_vocab(self)


BertModel.set_vocab = set_vocab

import convert_hf_to_gguf  # noqa: E402

sys.argv = ["convert_hf_to_gguf.py", model_dir, "--outtype", "q8_0", "--outfile", out]
convert_hf_to_gguf.main()
