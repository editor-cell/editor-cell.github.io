/** Runs before entry scripts: one retry per destination in this tab, including a lost
 * entry script. A reader's clicked link is kept even before the router updates the URL. */
export const CHUNK_RECOVERY_BOOT = `(${function () {
  let destination = "";
  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download"))
        return;
      if (link.origin === location.origin) destination = link.href;
    },
    true,
  );
  function recover(event: Event) {
    const target = destination || location.href;
    try {
      if (sessionStorage.getItem("orbis-chunk-reload") === target) return;
      sessionStorage.setItem("orbis-chunk-reload", target);
    } catch {
      return;
    } // With blocked storage, do not risk a reload loop.
    event.preventDefault();
    location.replace(target);
  }
  window.addEventListener("vite:preloadError", recover);
  window.addEventListener(
    "error",
    (event) => {
      const element = event.target;
      const address =
        element instanceof HTMLScriptElement
          ? element.src
          : element instanceof HTMLLinkElement
            ? element.href
            : "";
      if (
        address &&
        new URL(address).origin === location.origin &&
        new URL(address).pathname.startsWith("/assets/")
      )
        recover(event);
    },
    true,
  );
}.toString()})();`;
