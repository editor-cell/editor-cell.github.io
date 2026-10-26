import { useEffect, useState } from "react";

const KEY = "orbis-watch-later";
const EVENT = "orbis-watch-later-change";
let memory: string[] = [];
let memoryOnly = false;

function readSaved(): string[] {
  if (memoryOnly) return memory;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    memory = Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch { /* The current visit still keeps its choices when storage is unavailable. */ }
  return memory;
}

/** A watch-later list on this device, shared by the video page and the video index. */
export function useSavedVideos() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const update = () => setIds(readSaved());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  function toggle(id: string) {
    const current = readSaved();
    memory = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { memoryOnly = true; }
    setIds(memory);
    window.dispatchEvent(new Event(EVENT));
  }
  return { ids, toggle };
}
