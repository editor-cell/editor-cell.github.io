/**
 * Publishing from the panel: every save becomes one commit on the site's repository.
 * The "Publish site" workflow rebuilds the pages from that commit, so a reading saved
 * here reaches every reader within a few minutes.
 *
 * Access is a fine-grained GitHub token limited to this one repository (Contents: read
 * and write). It is kept only for this browser session (sessionStorage): closing the
 * browser forgets it, so it does not sit on the device where any script could find it.
 */

export const REPO = {
  owner: "editor-cell",
  name: "editor-cell.github.io",
  branch: "main",
};
export const TOKEN_PAGE = "https://github.com/settings/personal-access-tokens/new";

const API = "https://api.github.com";
const TOKEN_KEY = "orbis-github-token";

export function readToken(): string {
  try {
    // Earlier versions kept the token for good; clear that copy.
    localStorage.removeItem(TOKEN_KEY);
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Fired on window whenever the token is saved or cleared, so every part of the panel follows. */
export const TOKEN_EVENT = "orbis-token";

export function writeToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(TOKEN_EVENT));
  } catch {
    /* no window (prerender) */
  }
}

export class PublishError extends Error {
  constructor(
    /**
     * "conflict": the branch moved during the commit (retried once).
     * "stale": the reading was changed elsewhere after this editor opened it.
     */
    public kind: "auth" | "access" | "network" | "conflict" | "stale" | "other",
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new PublishError("network", "network");
  }
  if (res.status === 401) throw new PublishError("auth", "auth");
  if (res.status === 403 || res.status === 404)
    throw new PublishError("access", String(res.status));
  if (res.status === 409 || res.status === 422)
    throw new PublishError("conflict", await res.text());
  if (!res.ok) throw new PublishError("other", `${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const repoPath = `/repos/${REPO.owner}/${REPO.name}`;

/** Checks the token and that it may write to the repository. */
export async function checkToken(token: string): Promise<void> {
  const repo = await call<{ permissions?: { push?: boolean } }>(token, repoPath);
  if (!repo.permissions?.push) throw new PublishError("access", "no push");
}

/**
 * A text file as it is on the main branch right now, or null when there is no such file.
 * Read fresh every time (no browser cache), because it is compared before publishing.
 */
export async function readRepoFile(
  token: string,
  path: string,
  ref: string = REPO.branch,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(
      `${API}${repoPath}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  } catch {
    throw new PublishError("network", "network");
  }
  if (res.status === 404) return null;
  if (res.status === 401) throw new PublishError("auth", "auth");
  if (res.status === 403) throw new PublishError("access", "403");
  if (!res.ok) throw new PublishError("other", `${res.status}`);
  return await res.text();
}

/** A file to write (base64 content) or, with content null, to delete. */
export type Change = {
  path: string;
  base64: string | null;
  /** Expected text at the immutable parent commit; null means the file must be absent. */
  expected?: string | null;
};

/** Writes all changes as a single commit on the main branch. Retries once if main moved. */
export async function commit(token: string, message: string, changes: Change[]): Promise<void> {
  if (!changes.length) return;
  for (let attempt = 0; ; attempt++) {
    try {
      await commitOnce(token, message, changes);
      return;
    } catch (error) {
      if (error instanceof PublishError && error.kind === "conflict" && attempt === 0) continue;
      throw error;
    }
  }
}

async function commitOnce(token: string, message: string, changes: Change[]) {
  const ref = await call<{ object: { sha: string } }>(
    token,
    `${repoPath}/git/ref/heads/${REPO.branch}`,
  );
  const head = ref.object.sha;
  // Every attempt compares against the SAME immutable head used as the parent below.
  // Main moving afterwards is caught by the non-forced ref update and checked again.
  for (const change of changes) {
    if (Object.hasOwn(change, "expected")) {
      const text = await readRepoFile(token, change.path, head);
      if (text !== change.expected) throw new PublishError("stale", "changed elsewhere");
    }
  }
  const parent = await call<{ tree: { sha: string } }>(token, `${repoPath}/git/commits/${head}`);

  // Deleting a file that is not there makes the tree call fail, so only delete what exists.
  const existing = new Set<string>();
  const deletions = changes.filter((change) => change.base64 === null);
  if (deletions.length) {
    const tree = await call<{ tree: { path: string; type: string }[] }>(
      token,
      `${repoPath}/git/trees/${parent.tree.sha}?recursive=1`,
    );
    for (const item of tree.tree) if (item.type === "blob") existing.add(item.path);
  }

  const entries: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];
  for (const change of changes) {
    if (change.base64 === null) {
      if (existing.has(change.path))
        entries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await call<{ sha: string }>(token, `${repoPath}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: change.base64, encoding: "base64" }),
    });
    entries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  if (!entries.length) return;

  const tree = await call<{ sha: string }>(token, `${repoPath}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
  });
  const next = await call<{ sha: string }>(token, `${repoPath}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [head] }),
  });
  await call(token, `${repoPath}/git/refs/heads/${REPO.branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: next.sha, force: false }),
  });
}

/** UTF-8 text to base64. */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** The base64 part of a data: address. */
export function dataUrlBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? "" : dataUrl.slice(comma + 1);
}
