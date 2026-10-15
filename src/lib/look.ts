import { useEffect, useState } from "react";

/** Colour schemes for the whole site. "bordo" (Bordo) is the main one from 15 Oct 2026
 * evening: burgundy bands with the cream logo on cream paper. "classic" (Mürekkep, main
 * until then) has black bands with the cream logo; "kagit" is black on white paper, the
 * bands included; "bordo" the burgundy
 * bands; "kahve" the brown one with orange accents; "night" the dark one, for a dim room. */
export const LOOKS = ["bordo", "classic", "kagit", "kahve", "night"] as const;
export type Look = (typeof LOOKS)[number];

/** The scheme a reader sees until they choose another. */
export const MAIN_LOOK: Look = "bordo";

export const LOOK_KEY = "orbis-look";

/** Browser bar colour for each scheme (matches the header). */
export const BAR: Record<Look, string> = {
  kagit: "#ffffff",
  classic: "#0c0c0c",
  bordo: "#3c0911",
  kahve: "#2a1c14",
  night: "#050505",
};

/** Swatches shown next to each scheme's name in the menus: panel, paper. */
export const LOOK_SWATCH: Record<Look, [string, string]> = {
  // Black letters on white: the white half above, the ink below.
  kagit: ["#ffffff", "#0c0c0c"],
  classic: ["#0c0c0c", "#f4efe6"],
  bordo: ["#3c0911", "#fbf7ef"],
  kahve: ["#2a1c14", "#ffffff"],
  // The dark scheme is the classic disc turned over: light where classic is dark.
  night: ["#e7e4dd", "#161616"],
};

/**
 * Runs in <head> before the page paints, so a reader who chose another scheme never sees
 * a flash of the main one first. The page is written with data-look="bordo" (the main
 * scheme); Mürekkep (classic) is the plain stylesheet, with no data-look.
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
