/** A video chosen from a list should start on its own page, not wait behind the
 * globe for a second tap. The list marks the choice; the page takes it once. */
let pending: { id: string; at: number } | null = null;

export function playOnArrival(id: string) {
  pending = { id, at: Date.now() };
}

/** True once for the video just chosen; stale or other choices are dropped. */
export function takeArrival(id: string) {
  const choice = pending;
  pending = null;
  return !!choice && choice.id === id && Date.now() - choice.at < 10000;
}
