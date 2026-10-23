"""The single current experimental checkpoint. Never fall back to a base model."""
import base64
import json
import os
import pathlib
import urllib.request

STATE_PATH = "research-app/train/latest_model.json"


def current_model():
    value = json.loads((pathlib.Path(__file__).parent / "latest_model.json").read_text())
    repo = value["repo"]
    if not repo.startswith("orbisthereadingatlas/orbis-nli-"):
        raise ValueError("Only the current private Orbis experiment can be selected")
    return value


def record_latest(repo, revision):
    """Advance the pointer only after a completed training checkpoint upload."""
    previous = current_model()
    state = {"repo": repo, "revision": revision, "training_run": os.environ["GITHUB_RUN_ID"]}
    branch = os.environ["GITHUB_REF_NAME"]
    endpoint = "https://api.github.com/repos/" + os.environ["GITHUB_REPOSITORY"] + "/contents/" + STATE_PATH
    token = os.environ["GITHUB_TOKEN"]
    headers = {"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"}
    request = urllib.request.Request(endpoint + "?ref=" + branch, headers=headers)
    with urllib.request.urlopen(request, timeout=45) as response:
        remote = json.load(response)
    remote_state = json.loads(base64.b64decode(remote["content"]))
    if remote_state != previous:
        raise RuntimeError("A different round already advanced the latest-model pointer; refusing to overwrite it")
    content = json.dumps(state, indent=2) + "\n"
    payload = {"message": "Advance the current experiment to the completed training checkpoint",
               "branch": branch, "sha": remote["sha"],
               "content": base64.b64encode(content.encode()).decode()}
    request = urllib.request.Request(endpoint, data=json.dumps(payload).encode(), headers=headers, method="PUT")
    with urllib.request.urlopen(request, timeout=45) as response:
        json.load(response)
    (pathlib.Path(__file__).parent / "latest_model.json").write_text(content)
