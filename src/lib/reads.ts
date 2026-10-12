import { useEffect, useState } from "react";
import { membersOn } from "@/lib/members/config";
import { supabase, useMember } from "@/lib/members/session";

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

/**
 * The signed-in member's reading history (supabase/orbis-members.sql, the "history" part).
 * Opening a reading puts it at the top of the member's own list; nothing is sent for a
 * visitor who is not signed in.
 */
export function useNoteRead(storyId: string | undefined): void {
  const member = useMember();
  const userId = member.status === "in" ? member.user.id : null;
  useEffect(() => {
    if (!membersOn || !storyId || !userId) return;
    void supabase()
      .then((client) => client.rpc("note_read", { p_story: storyId }))
      .catch(() => {
        /* a missed entry is not worth troubling the reader */
      });
  }, [storyId, userId]);
}

export type HistoryEntry = { storyId: string; readAt: string };

/**
 * The member's history, newest first: null while loading, [] when empty. `available` turns
 * false when the history cannot be read (the database part not set up yet), and the account
 * page then leaves the section out instead of showing an empty list.
 */
export function useHistory(userId: string): {
  entries: HistoryEntry[] | null;
  available: boolean;
  clear: () => Promise<boolean>;
} {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    let live = true;
    void supabase()
      .then((client) =>
        client
          .from("history")
          .select("story_id, read_at")
          .eq("user_id", userId)
          .order("read_at", { ascending: false })
          .limit(100),
      )
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setAvailable(false);
          return;
        }
        const rows = (data as { story_id: string; read_at: string }[] | null) ?? [];
        setEntries(rows.map((row) => ({ storyId: row.story_id, readAt: row.read_at })));
      })
      .catch(() => {
        if (live) setAvailable(false);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  async function clear(): Promise<boolean> {
    try {
      const client = await supabase();
      const { error } = await client.from("history").delete().eq("user_id", userId);
      if (error) return false;
      setEntries([]);
      return true;
    } catch {
      return false;
    }
  }

  return { entries, available, clear };
}
