#!/usr/bin/env bash
# Puts llama.cpp, at the commit named in llama.cpp.version, where the app's native build expects it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
rev="$(tr -d '[:space:]' < "$here/llama.cpp.version")"
dest="$here/app/src/main/cpp/llama.cpp"
rm -rf "$dest" && mkdir -p "$dest"
curl -fsSL "https://github.com/ggml-org/llama.cpp/archive/$rev.tar.gz" | tar xz --strip-components=1 -C "$dest"
echo "llama.cpp $rev ready"
