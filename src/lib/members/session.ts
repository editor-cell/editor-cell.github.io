import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { MEMBERS, membersOn } from "./config.ts";

/**
 * The signed-in member, shared by every part of the page that needs it (the header icon,
 * the comments, the locks, the account page). The Supabase library is downloaded only when
 * membership is switched on and a page first asks for the member.
 */

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "reader" | "editor";
  paid_until: string | null;
};

export type Member =
  | { status: "off" }
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; user: User; profile: Profile | null };

let clientPromise: Promise<SupabaseClient> | null = null;

export function supabase(): Promise<SupabaseClient> {
  if (!membersOn) return Promise.reject(new Error("Membership is switched off"));
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(MEMBERS.supabaseUrl, MEMBERS.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

const OFF: Member = { status: "off" };
const LOADING: Member = { status: "loading" };

let state: Member = membersOn ? LOADING : OFF;
let started = false;
const listeners = new Set<() => void>();

function set(next: Member) {
  state = next;
  for (const listener of listeners) listener();
}

async function loadProfile(client: SupabaseClient, user: User): Promise<Profile | null> {
  const { data } = await client
    .from("profiles")
    .select("id, email, display_name, role, paid_until")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

async function apply(client: SupabaseClient, user: User | null) {
  if (!user) {
    set({ status: "out" });
    return;
  }
  set({ status: "in", user, profile: await loadProfile(client, user) });
}

function start() {
  if (started || !membersOn || typeof window === "undefined") return;
  started = true;
  supabase()
    .then(async (client) => {
      client.auth.onAuthStateChange((_event, session) => {
        // Supabase asks that the callback not wait on other calls; run them just after.
        window.setTimeout(() => void apply(client, session?.user ?? null), 0);
      });
      const { data } = await client.auth.getSession();
      await apply(client, data.session?.user ?? null);
    })
    .catch(() => set({ status: "out" }));
}

/** Reads the profile again, after the member renames themselves or the editor changes it. */
export async function refreshProfile() {
  if (state.status !== "in") return;
  const client = await supabase();
  await apply(client, state.user);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMember(): Member {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => (membersOn ? LOADING : OFF),
  );
}

/** Paid members and the editor open members-only readings. */
export function isPaid(profile: Profile | null, now = Date.now()): boolean {
  if (!profile) return false;
  if (profile.role === "editor") return true;
  return profile.paid_until !== null && new Date(profile.paid_until).getTime() > now;
}

export function isEditor(member: Member): boolean {
  return member.status === "in" && member.profile?.role === "editor";
}
