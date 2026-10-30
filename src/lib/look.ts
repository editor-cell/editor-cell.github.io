import { useEffect, useState } from "react";

/** Colour schemes for the whole site. Since 15 Oct 2026 night there are two: "classic"
 * (Mürekkep, the main one: ink on white paper) and "night" (the
 * dark one, for a dim room). Bordo, Kâğıt and Kahverengi were taken out the same night; a
 * reader who had chosen one of them simply sees the main scheme. */
export const LOOKS = ["classic", "night"] as const;
export type Look = (typeof LOOKS)[number];

/** The scheme a reader sees until they choose another. */
export const MAIN_LOOK: Look = "classic";

export const LOOK_KEY = "orbis-look";

/** Browser bar colour for each scheme (matches the header). */
export const BAR: Record<Look, string> = {
  classic: "#ffffff",
  night: "#141414",
};

/** Swatches shown next to each scheme's name in the menus: ink, paper. */
export const LOOK_SWATCH: Record<Look, [string, string]> = {
  classic: ["#0c0c0c", "#ffffff"],
  // The dark scheme is the classic disc turned over: light where classic is dark.
  night: ["#e7e4dd", "#141414"],
};

/**
 * Runs in <head> before the page paints, so a reader who chose the dark scheme never sees
 * a flash of the main one first. The page is written with no data-look (the main scheme,
 * Mürekkep, is the plain stylesheet); a stored choice that is no longer offered is ignored.
 */
export const LOOK_BOOT = `try{var l=localStorage.getItem("${LOOK_KEY}"),b=${JSON.stringify(BAR)};if(l&&b[l]){var h=document.documentElement;if(l==="classic")h.removeAttribute("data-look");else h.setAttribute("data-look",l);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",b[l])}}catch(e){}`;

function readLook(): Look {
  try {
    const saved = localStorage.getItem(LOOK_KEY);
    return (LOOKS as readonly string[]).includes(saved ?? "") ? (saved as Look) : MAIN_LOOK;
  } catch {
    return MAIN_LOOK;
  }
}

function applyLook(look: Look) {
  const html = document.documentElement;
  if (look === "classic") html.removeAttribute("data-look");
  else html.setAttribute("data-look", look);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[look]);
}

const listeners = new Set<(look: Look) => void>();

export function useLook(): [Look, (look: Look) => void] {
  const [look, setLookState] = useState<Look>(MAIN_LOOK);

  useEffect(() => {
    setLookState(readLook());
    listeners.add(setLookState);
    return () => {
      listeners.delete(setLookState);
    };
  }, []);

  function setLook(next: Look) {
    try {
      localStorage.setItem(LOOK_KEY, next);
    } catch {
      /* the choice still holds for this visit */
    }
    applyLook(next);
    listeners.forEach((fn) => fn(next));
  }

  return [look, setLook];
}
