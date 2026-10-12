import { useEffect, useState } from "react";
import { membersOn } from "@/lib/members/config";
import { supabase } from "@/lib/members/session";

/**
 * Read counts for the "Most read" column. They are kept in the same Supabase project as
 * membership (supabase/orbis-members.sql, the "reads" part), so they start counting the
 * day membership is switched on. Until then nothing is sent and the column falls back to
 * the newest readings under another name.
 */

const SEEN_KEY = "orbis-read-";

/** One count per reading per browser tab session, so reloading a page adds nothing. */
export function countRead(storyId: string): void {
  if (!membersOn || typeof window === "undefined") return;
  // Only readers of the real site count; test copies and previews do not.
  if (!/(^|\.)orbisreadingatlas\.com$/.test(window.location.hostname)) return;
  try {
    if (sessionStorage.getItem(SEEN_KEY + storyId)) return;
    sessionStorage.setItem(SEEN_KEY + storyId, "1");
  } catch {
    /* private window: count anyway */
  }
  void supabase()
    .then((client) => client.rpc("count_read", { p_story: storyId }))
    .catch(() => {
      /* a missed count is not worth troubling the reader */
    });
}

/** Reading ids, most read first; null while unknown or when counting is off. */
export function useMostRead(limit: number): string[] | null {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!membersOn) return;
    let live = true;
    void supabase()
      .then((client) => client.rpc("most_read", { p_limit: limit }))
      .then(({ data }) => {
        if (!live || !Array.isArray(data)) return;
        const list = (data as { story_id: string }[]).map((row) => row.story_id);
        setIds(list.length ? list : null);
      })
      .catch(() => {
        /* keep the fallback */
      });
    return () => {
      live = false;
    };
  }, [limit]);
  return ids;
}
