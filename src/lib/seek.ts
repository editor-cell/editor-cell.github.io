/**
 * Moving a film to a second. When the server sends a film only whole (no byte ranges),
 * the browser cannot jump inside it and quietly starts again from the beginning. Then the
 * film is read once whole into the page and played from there, where every second can be
 * reached; the jump asked for is made on that copy.
 */

const whole = new WeakMap<HTMLVideoElement, Promise<void>>();

function once(el: HTMLVideoElement, name: string): Promise<void> {
  return new Promise((done) => el.addEventListener(name, () => done(), { once: true }));
}

/** Metadata first: before it the browser knows neither the length nor what can be reached. */
async function ready(el: HTMLVideoElement): Promise<void> {
  if (el.readyState >= HTMLMediaElement.HAVE_METADATA) return;
  if (el.preload === "none") {
    el.preload = "metadata";
    el.load();
  }
  await once(el, "loadedmetadata");
}

/** Can the browser reach this second of the film as it is served? */
function reachable(el: HTMLVideoElement, seconds: number): boolean {
  const ranges = el.seekable;
  for (let i = 0; i < ranges.length; i += 1)
    if (seconds >= ranges.start(i) && seconds <= ranges.end(i) + 0.5) return true;
  return false;
}

/** The film read whole into the page, so that every second of it can be reached. */
function holdWhole(el: HTMLVideoElement): Promise<void> {
  let job = whole.get(el);
  if (!job) {
    const source = el.currentSrc || el.src;
    job = fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then(async (blob) => {
        el.src = URL.createObjectURL(blob);
        await once(el, "loadedmetadata");
      });
    job.catch(() => whole.delete(el));
    whole.set(el, job);
  }
  return job;
}

/** The film at this second; it plays on if it was playing (or if asked to). */
export async function seekTo(el: HTMLVideoElement, seconds: number, play = !el.paused) {
  el.currentTime = seconds;
  if (seconds <= 0.5) return;
  try {
    await ready(el);
    if (!reachable(el, seconds)) {
      await holdWhole(el);
      el.currentTime = seconds;
      if (play) await el.play();
    } else if (Math.abs(el.currentTime - seconds) > 1) {
      el.currentTime = seconds;
    }
  } catch {
    /* the film stays where the browser could put it */
  }
}
