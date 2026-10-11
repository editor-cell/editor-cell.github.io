import { useEffect, useState } from "react";

/** Colour schemes for the whole site. "classic" is the original black-and-grey one;
 * "kahve" the brown one with orange accents; "night" the dark one, for reading in a dim room. */
export const LOOKS = ["classic", "bordo", "kahve", "night"] as const;
export type Look = (typeof LOOKS)[number];

export const LOOK_KEY = "orbis-look";

/** Browser bar colour for each scheme (matches the header). */
const BAR: Record<Look, string> = {
  classic: "#0c0c0c",
  bordo: "#5a1523",
  kahve: "#2f2013",
  night: "#050505",
};

/** Swatches shown next to each scheme's name in the menus: panel, paper. */
export const LOOK_SWATCH: Record<Look, [string, string]> = {
  classic: ["#0c0c0c", "#f4f4f5"],
  bordo: ["#5a1523", "#fbf7ef"],
  kahve: ["#2f2013", "#ffffff"],
  // The dark scheme is the classic disc turned over: light where classic is dark.
  night: ["#e7e4dd", "#161616"],
};

/**
 * Runs in <head> before the page paints, so a reader who chose burgundy
 * never sees a flash of the black header first.
 */
export const LOOK_BOOT = `try{var l=localStorage.getItem("${LOOK_KEY}"),b=${JSON.stringify(BAR)};if(l&&l!=="classic"&&b[l]){document.documentElement.setAttribute("data-look",l);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",b[l])}}catch(e){}`;

function readLook(): Look {
  try {
    const saved = localStorage.getItem(LOOK_KEY);
    return (LOOKS as readonly string[]).includes(saved ?? "") ? (saved as Look) : "classic";
  } catch {
    return "classic";
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
  const [look, setLookState] = useState<Look>("classic");

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
